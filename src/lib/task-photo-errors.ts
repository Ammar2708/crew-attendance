type BackendError = { code?: string; message?: string };

export function isMissingCaptureTimeColumn(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as BackendError;
  return (code === 'PGRST204' || code === '42703') &&
    typeof message === 'string' && message.includes('captured_at');
}

export function photoSubmissionErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error &&
      typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return 'Unable to submit the photos. Please try again.';
}

export function photoCaptureTime(photo: {
  captured_at?: string | null;
  photo_url: string;
  uploaded_at: string;
}) {
  // New filenames preserve capture time even on databases without captured_at.
  const timestamp = photo.photo_url.match(/(?:^|\/)capture-(\d{13})-/)?.[1];
  return photo.captured_at ?? (timestamp ? new Date(Number(timestamp)).toISOString() : photo.uploaded_at);
}
