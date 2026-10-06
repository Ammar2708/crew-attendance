import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, Palette, Radius } from '@/constants/theme';
import type { EmployeeProfile } from '@/types/tasks';

type EmployeePickerProps = {
  employees: EmployeeProfile[];
  value: string;
  onChange: (employeeId: string) => void;
  distancesByEmployeeId?: ReadonlyMap<string, number>;
};

function formatDistance(distanceKm: number) {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m away`;
  return `${distanceKm.toFixed(1)} km away`;
}

export function EmployeePicker({
  employees,
  value,
  onChange,
  distancesByEmployeeId,
}: EmployeePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === value) ?? employees[0],
    [employees, value],
  );
  const selectedDistance = selectedEmployee
    ? distancesByEmployeeId?.get(selectedEmployee.id)
    : undefined;

  return (
    <>
      <Pressable
        disabled={employees.length === 0}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [styles.select, pressed && styles.pressed]}>
        <Text style={[styles.selectText, !selectedEmployee && styles.placeholder]}>
          {selectedEmployee
            ? `${selectedEmployee.full_name}${selectedDistance == null ? '' : ` — ${formatDistance(selectedDistance)}`}`
            : 'No active employees'}
        </Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>

      <Modal animationType="slide" onRequestClose={() => setIsOpen(false)} visible={isOpen}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select employee</Text>
            <Pressable onPress={() => setIsOpen(false)}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            contentContainerStyle={styles.list}
            data={employees}
            keyExtractor={(employee) => employee.id}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.id);
                  setIsOpen(false);
                }}
                style={({ pressed }) => [
                  styles.option,
                  item.id === selectedEmployee?.id && styles.selectedOption,
                  pressed && styles.pressed,
                ]}>
                <View style={styles.optionCopy}>
                  <Text style={styles.optionName}>{item.full_name}</Text>
                  <Text style={styles.optionRole}>
                    {item.role}{distancesByEmployeeId?.has(item.id) ? ' · clocked in' : ''}
                  </Text>
                </View>
                {distancesByEmployeeId?.has(item.id) ? (
                  <Text style={styles.optionDistance}>
                    {formatDistance(distancesByEmployeeId.get(item.id)!)}
                  </Text>
                ) : null}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  select: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Palette.steel,
    borderRadius: Radius.control,
    paddingHorizontal: 14,
    backgroundColor: Palette.surface,
  },
  selectText: { flex: 1, color: Palette.ink, fontFamily: Fonts.sans, fontSize: 16 },
  placeholder: { color: Palette.steel },
  chevron: { color: Palette.steel, fontSize: 20 },
  modalSafeArea: { flex: 1, backgroundColor: Palette.paper },
  modalHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Palette.line,
    backgroundColor: Palette.paper,
  },
  modalTitle: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 18 },
  done: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 16 },
  list: { padding: 20 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: Palette.surface, borderBottomWidth: 1, borderBottomColor: Palette.line },
  selectedOption: { borderLeftColor: Palette.safety, borderLeftWidth: 4 },
  optionCopy: { flex: 1 },
  optionName: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 16 },
  optionRole: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 13, marginTop: 3 },
  optionDistance: { color: Palette.onSite, fontFamily: Fonts.monoSemiBold, fontSize: 13 },
  pressed: { opacity: 0.65 },
});
