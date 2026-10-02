import { CameraView, type CameraCapturedPicture, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CheckmarkDraw,
  StatusStamp,
  ledgerControls,
} from '@/components/site-ledger-ui';
import { Fonts, Palette, Radius } from '@/constants/theme';
import { useTask } from '@/hooks/use-tasks';
import { supabase } from '@/lib/supabase';

type TaskDetailScreenProps = {
  taskId: string;
  userId: string;
};

type PhotoSource = 'camera' | 'gallery';

type SelectedPhoto = {
  id: string;
  uri: string;
  source: PhotoSource;
  fileName?: string | null;
  mimeType?: string | null;
  format?: CameraCapturedPicture['format'];
};

type PermissionIssue = {
  source: PhotoSource;
  canAskAgain: boolean;
};

const IMAGE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const IMAGE_MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function createSelectedPhotoId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getUploadMetadata(photo: SelectedPhoto) {
  const mimeType = photo.mimeType?.toLowerCase();
  const fileExtension = photo.fileName?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  const uriExtension = photo.uri.split(/[?#]/, 1)[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  const extension =
    (mimeType && IMAGE_EXTENSION_BY_MIME_TYPE[mimeType]) ||
    photo.format ||
    (fileExtension && IMAGE_MIME_TYPE_BY_EXTENSION[fileExtension] ? fileExtension : null) ||
    (uriExtension && IMAGE_MIME_TYPE_BY_EXTENSION[uriExtension] ? uriExtension : null) ||
    'jpg';

  return {
    extension,
    contentType: mimeType?.startsWith('image/')
      ? mimeType
      : (IMAGE_MIME_TYPE_BY_EXTENSION[extension] ?? 'image/jpeg'),
  };
}

export function TaskDetailScreen({ taskId, userId }: TaskDetailScreenProps) {
  const { task, isLoading, errorMessage: taskError, markCompleted } = useTask(taskId, userId);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaLibraryPermission, requestMediaLibraryPermission] =
    ImagePicker.useMediaLibraryPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permissionIssue, setPermissionIssue] = useState<PermissionIssue | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [justCompleted, setJustCompleted] = useState(false);

  async function openCamera() {
    setErrorMessage(null);
    setSuccessMessage(null);

    const response = cameraPermission?.granted
      ? cameraPermission
      : await requestCameraPermission();
    if (!response.granted) {
      setPermissionIssue({ source: 'camera', canAskAgain: response.canAskAgain });
      return;
    }

    setPermissionIssue(null);
    setIsCameraReady(false);
    setIsCameraOpen(true);
  }

  async function chooseFromGallery() {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = mediaLibraryPermission?.granted
        ? mediaLibraryPermission
        : await requestMediaLibraryPermission();
      if (!response.granted) {
        setPermissionIssue({ source: 'gallery', canAskAgain: response.canAskAgain });
        return;
      }

      setPermissionIssue(null);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        setPhotos((current) => [
          ...current,
          ...result.assets.map((asset) => ({
            id: createSelectedPhotoId(),
            uri: asset.uri,
            source: 'gallery' as const,
            fileName: asset.fileName,
            mimeType: asset.mimeType,
          })),
        ]);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to choose a photo from the library.',
      );
    }
  }

  async function capturePhoto() {
    if (!cameraRef.current || !isCameraReady || isCapturing) return;

    setIsCapturing(true);
    setErrorMessage(null);

    try {
      const capturedPhoto = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      setPhotos((current) => [
        ...current,
        {
          id: createSelectedPhotoId(),
          uri: capturedPhoto.uri,
          source: 'camera',
          format: capturedPhoto.format,
        },
      ]);
      setIsCameraOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to take the photo.');
    } finally {
      setIsCapturing(false);
    }
  }

  function removePhoto(photoId: string) {
    setPhotos((current) => current.filter((photo) => photo.id !== photoId));
  }

  async function submitPhotos() {
    if (photos.length === 0 || !task || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    const uploadedPaths: string[] = [];

    try {
      const photoRows: { task_id: string; photo_url: string; source: PhotoSource }[] = [];

      for (const photo of photos) {
        const fileResponse = await fetch(photo.uri);
        if (!fileResponse.ok) throw new Error('Unable to read one of the selected photos.');

        const { extension, contentType } = getUploadMetadata(photo);
        const filename = `task-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extension}`;
        const objectPath = `${task.id}/${filename}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('task-photos')
          .upload(objectPath, await fileResponse.arrayBuffer(), {
            contentType,
            upsert: false,
          });

        if (uploadError) throw uploadError;
        uploadedPaths.push(uploadData.path);
        photoRows.push({ task_id: task.id, photo_url: uploadData.path, source: photo.source });
      }

      const { error: photoError } = await supabase.from('task_photos').insert(photoRows);

      if (photoError) throw photoError;

      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', task.id)
        .eq('assigned_to', userId)
        .select('id')
        .single();

      if (updateError) throw updateError;

      markCompleted();
      const submittedPhotoCount = photos.length;
      setPhotos([]);
      setJustCompleted(true);
      setSuccessMessage(
        `${submittedPhotoCount} ${submittedPhotoCount === 1 ? 'photo' : 'photos'} submitted and task marked completed.`,
      );
    } catch (error) {
      if (uploadedPaths.length > 0) {
        await supabase
          .from('task_photos')
          .delete()
          .eq('task_id', task.id)
          .in('photo_url', uploadedPaths);
        await supabase.storage.from('task-photos').remove(uploadedPaths);
      }
      setErrorMessage(error instanceof Error ? error.message : 'Unable to submit the photos.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isCameraOpen) {
    return (
      <View style={styles.cameraScreen}>
        <CameraView
          facing="back"
          mode="picture"
          onCameraReady={() => setIsCameraReady(true)}
          onMountError={({ message }) => setErrorMessage(message)}
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.cameraControls}>
          <Pressable onPress={() => setIsCameraOpen(false)} style={styles.cameraCancel}>
            <Text style={styles.cameraCancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            disabled={!isCameraReady || isCapturing}
            onPress={() => void capturePhoto()}
            style={[styles.shutter, (!isCameraReady || isCapturing) && styles.disabled]}>
            {isCapturing ? <ActivityIndicator color={Palette.ink} /> : <View style={styles.shutterInner} />}
          </Pressable>
          <View style={styles.cameraControlSpacer} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => pressed && styles.pressed}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Task details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading ? (
          <ActivityIndicator color={Palette.safety} size="large" />
        ) : taskError || !task ? (
          <Text style={styles.error}>{taskError ?? 'Task not found.'}</Text>
        ) : (
          <View style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{task.title}</Text>
              <StatusStamp
                animate={justCompleted}
                key={`${task.status}-${justCompleted ? 'new' : 'loaded'}`}
                tone={task.status === 'completed' ? 'positive' : 'warning'}>
                {task.status}
              </StatusStamp>
            </View>
            <Text style={styles.label}>Site address</Text>
            <Text style={styles.address}>{task.site_address}</Text>
            {task.due_date ? (
              <>
                <Text style={styles.label}>Due date</Text>
                <Text style={styles.dueDate}>{task.due_date}</Text>
              </>
            ) : null}

            {photos.length > 0 ? (
              <View style={styles.previewSection}>
                <Text style={styles.attachedPhotosLabel}>
                  {photos.length} {photos.length === 1 ? 'photo' : 'photos'} attached
                </Text>
                <View style={styles.photoGrid}>
                  {photos.map((photo, index) => (
                    <View key={photo.id} style={styles.photoTile}>
                      <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} />
                      <Text style={styles.photoSourceBadge}>
                        {photo.source === 'camera' ? 'Camera' : 'Gallery'}
                      </Text>
                      <Pressable
                        accessibilityLabel={`Remove photo ${index + 1}`}
                        accessibilityRole="button"
                        disabled={isSubmitting}
                        hitSlop={8}
                        onPress={() => removePhoto(photo.id)}
                        style={({ pressed }) => [
                          styles.removePhotoButton,
                          pressed && styles.pressed,
                        ]}>
                        <Text style={styles.removePhotoButtonText}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
                <View style={styles.addPhotoActions}>
                  <Pressable
                    disabled={isSubmitting}
                    onPress={() => void openCamera()}
                    style={[styles.primaryButton, styles.addPhotoButton]}>
                    <Text style={styles.primaryButtonText}>Take photo</Text>
                  </Pressable>
                  <Pressable
                    disabled={isSubmitting}
                    onPress={() => void chooseFromGallery()}
                    style={[styles.secondaryButton, styles.addPhotoButton]}>
                    <Text style={styles.secondaryButtonText}>Choose from gallery</Text>
                  </Pressable>
                </View>
                <Pressable
                  disabled={isSubmitting}
                  onPress={() => void submitPhotos()}
                  style={[
                    styles.primaryButton,
                    styles.submitButton,
                    isSubmitting && styles.disabled,
                  ]}>
                  {isSubmitting ? (
                    <ActivityIndicator color={Palette.ink} />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      Submit {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
                    </Text>
                  )}
                </Pressable>
              </View>
            ) : task.status === 'completed' ? (
              <View style={styles.completedMessage}>
                <CheckmarkDraw animate={justCompleted} />
                <Text style={styles.completedMessageText}>This task is completed.</Text>
              </View>
            ) : (
              <View style={styles.photoSourceActions}>
                <Pressable
                  onPress={() => void openCamera()}
                  style={[styles.primaryButton, styles.photoSourceButton]}>
                  <Text style={styles.primaryButtonText}>Take photo</Text>
                </Pressable>
                <Pressable
                  onPress={() => void chooseFromGallery()}
                  style={[styles.secondaryButton, styles.photoSourceButton]}>
                  <Text style={styles.secondaryButtonText}>Choose from gallery</Text>
                </Pressable>
              </View>
            )}

            {permissionIssue ? (
              <View style={styles.notice}>
                <Text style={styles.error}>
                  {permissionIssue.source === 'camera'
                    ? 'Camera permission is required to photograph this task.'
                    : 'Photo library permission is required to choose a task photo.'}
                </Text>
                <Pressable
                  onPress={() =>
                    void (permissionIssue.canAskAgain
                      ? permissionIssue.source === 'camera'
                        ? openCamera()
                        : chooseFromGallery()
                      : Linking.openSettings())
                  }>
                  <Text style={styles.settingsLink}>
                    {permissionIssue.canAskAgain ? 'Try again' : 'Open settings'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
            {successMessage ? <Text style={styles.success}>{successMessage}</Text> : null}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Palette.paper },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Palette.line,
    backgroundColor: Palette.paper,
  },
  back: { width: 72, color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 15 },
  headerTitle: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 18 },
  headerSpacer: { width: 72 },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  card: {
    width: '100%',
    maxWidth: 760,
    backgroundColor: Palette.surface,
    borderTopColor: Palette.ink,
    borderTopWidth: 2,
    borderBottomColor: Palette.line,
    borderBottomWidth: 1,
    padding: 24,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { flex: 1, color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 27, lineHeight: 34 },
  label: { color: Palette.steel, fontFamily: Fonts.sansMedium, fontSize: 13, marginTop: 24 },
  address: { color: Palette.ink, fontFamily: Fonts.sans, fontSize: 16, lineHeight: 24, marginTop: 5 },
  dueDate: { color: Palette.ink, fontFamily: Fonts.mono, fontSize: 15, lineHeight: 24, marginTop: 5 },
  primaryButton: { ...ledgerControls.primary, flex: 1, marginTop: 28 },
  primaryButtonText: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 16 },
  secondaryButton: { ...ledgerControls.secondary, flex: 1, marginTop: 28 },
  secondaryButtonText: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 16 },
  photoSourceActions: { gap: 12, marginTop: 28 },
  photoSourceButton: { flex: 0, marginTop: 0 },
  previewSection: { width: '100%', alignSelf: 'center', marginTop: 24 },
  attachedPhotosLabel: {
    color: Palette.ink,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    marginBottom: 10,
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoTile: {
    position: 'relative',
    width: '31%',
    minWidth: 84,
    aspectRatio: 1,
    borderRadius: Radius.control,
    overflow: 'hidden',
    backgroundColor: Palette.line,
  },
  photoThumbnail: { width: '100%', height: '100%' },
  photoSourceBadge: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    color: Palette.surface,
    backgroundColor: `${Palette.ink}CC`,
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    fontFamily: Fonts.sansSemiBold,
    fontSize: 9,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: `${Palette.ink}E6`,
  },
  removePhotoButtonText: {
    color: Palette.surface,
    fontFamily: Fonts.sansBold,
    fontSize: 22,
    lineHeight: 24,
  },
  addPhotoActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  addPhotoButton: { marginTop: 0 },
  submitButton: { flex: 0, marginTop: 12 },
  notice: { alignItems: 'center', gap: 8, marginTop: 18 },
  error: { color: Palette.alert, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 16 },
  success: { color: Palette.onSite, fontFamily: Fonts.sansMedium, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 16 },
  settingsLink: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 14 },
  completedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderColor: Palette.onSite,
    borderWidth: 1,
    padding: 16,
    marginTop: 28,
  },
  completedMessageText: { color: Palette.onSite, fontFamily: Fonts.sansSemiBold, fontSize: 14 },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.65 },
  cameraScreen: { flex: 1, backgroundColor: Palette.ink },
  cameraControls: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 28, paddingBottom: 28 },
  cameraCancel: { width: 72, paddingVertical: 12 },
  cameraCancelText: { color: Palette.surface, fontFamily: Fonts.sansBold, fontSize: 16 },
  cameraControlSpacer: { width: 72 },
  shutter: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.surface },
  shutterInner: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, borderColor: Palette.ink },
});
