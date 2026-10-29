import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  const allEmployeesSelected = employees.length > 0 && selectedEmployees.length === employees.length;
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
        accessibilityState={{ expanded: isOpen }}
        accessibilityRole="button"
        disabled={employees.length === 0}
        onPress={() => setIsOpen((open) => !open)}
        style={({ pressed }) => [styles.select, pressed && styles.pressed]}>
        <Text style={[styles.selectText, selectedEmployees.length === 0 && styles.placeholder]}>
          {employees.length === 0 ? 'No active employees' : selectionLabel}
        </Text>
        <Text style={styles.chevron}>⌄</Text>
      </Pressable>

      {isOpen ? (
        <View style={styles.employeePanel}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select employees</Text>
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => onChange(allEmployeesSelected ? [] : employees.map((employee) => employee.id))}>
                <Text style={styles.selectAll}>{allEmployeesSelected ? 'Clear all' : 'Select all'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setIsOpen(false)}>
                <Text style={styles.done}>Done</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.list} nestedScrollEnabled style={styles.employeeList}>
            {employees.map((employee) => {
              const isSelected = value.includes(employee.id);
              return (
                <Pressable
                  key={employee.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected }}
                  onPress={() => {
                    onChange(
                      isSelected
                        ? value.filter((employeeId) => employeeId !== employee.id)
                        : [...value, employee.id],
                    );
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    isSelected && styles.selectedOption,
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionName}>{employee.full_name}</Text>
                    <Text style={styles.optionRole}>
                      {employee.role}{distancesByEmployeeId?.has(employee.id) ? ' - clocked in' : ''}
                    </Text>
                  </View>
                  <View style={styles.optionTrailing}>
                    {distancesByEmployeeId?.has(employee.id) ? (
                      <Text style={styles.optionDistance}>
                        {formatDistance(distancesByEmployeeId.get(employee.id)!)}
                      </Text>
                    ) : null}
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
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
  employeePanel: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: Palette.line,
    backgroundColor: Palette.paper,
  },
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
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  selectAll: { color: Palette.onSite, fontFamily: Fonts.sansSemiBold, fontSize: 14 },
  done: { color: Palette.ink, fontFamily: Fonts.sansBold, fontSize: 16 },
  employeeList: { maxHeight: 320 },
  list: { padding: 10 },
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
