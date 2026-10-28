import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Fonts, Palette, Radius } from '@/constants/theme';
import type { EmployeeProfile } from '@/types/tasks';

type EmployeePickerProps = {
  employees: EmployeeProfile[];
  value: string[];
  onChange: (employeeIds: string[]) => void;
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
  const selectedEmployees = useMemo(
    () => employees.filter((employee) => value.includes(employee.id)),
    [employees, value],
  );
  const selectionLabel = selectedEmployees.length === 0
    ? 'Select employees'
    : selectedEmployees.length === 1
      ? `${selectedEmployees[0].full_name}${distancesByEmployeeId?.has(selectedEmployees[0].id)
        ? ` — ${formatDistance(distancesByEmployeeId.get(selectedEmployees[0].id)!)}`
        : ''}`
      : `${selectedEmployees.length} employees selected`;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        disabled={employees.length === 0}
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [styles.select, pressed && styles.pressed]}>
        <Text style={[styles.selectText, selectedEmployees.length === 0 && styles.placeholder]}>
          {employees.length === 0 ? 'No active employees' : selectionLabel}
        </Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>

      <Modal animationType="slide" onRequestClose={() => setIsOpen(false)} visible={isOpen}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select employees</Text>
            <Pressable accessibilityRole="button" onPress={() => setIsOpen(false)}>
              <Text style={styles.done}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            contentContainerStyle={styles.list}
            data={employees}
            keyExtractor={(employee) => employee.id}
            renderItem={({ item }) => {
              const isSelected = value.includes(item.id);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => {
                    onChange(
                      isSelected
                        ? value.filter((employeeId) => employeeId !== item.id)
                        : [...value, item.id],
                    );
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    isSelected && styles.selectedOption,
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionName}>{item.full_name}</Text>
                    <Text style={styles.optionRole}>
                      {item.role}{distancesByEmployeeId?.has(item.id) ? ' · clocked in' : ''}
                    </Text>
                  </View>
                  <View style={styles.optionTrailing}>
                    {distancesByEmployeeId?.has(item.id) ? (
                      <Text style={styles.optionDistance}>
                        {formatDistance(distancesByEmployeeId.get(item.id)!)}
                      </Text>
                    ) : null}
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                  </View>
                </Pressable>
              );
            }}
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: Palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: Palette.line,
  },
  selectedOption: { borderLeftColor: Palette.safety, borderLeftWidth: 4 },
  optionCopy: { flex: 1 },
  optionName: { color: Palette.ink, fontFamily: Fonts.sansSemiBold, fontSize: 16 },
  optionRole: { color: Palette.steel, fontFamily: Fonts.sans, fontSize: 13, marginTop: 3 },
  optionDistance: { color: Palette.onSite, fontFamily: Fonts.monoSemiBold, fontSize: 13 },
  optionTrailing: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  checkbox: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.steel,
    borderRadius: 5,
  },
  checkboxSelected: { backgroundColor: Palette.safety, borderColor: Palette.safety },
  checkmark: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 15, lineHeight: 18 },
  pressed: { opacity: 0.65 },
});
