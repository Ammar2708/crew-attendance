import type { AttendanceCoordinates } from '@/types/attendance';

export type EmployeeMapLocation = {
  id: string;
  name: string;
  coordinate: AttendanceCoordinates;
};

export type TaskLocationMapProps = {
  employeeLocations: EmployeeMapLocation[];
  onSelectTaskLocation: (coordinate: AttendanceCoordinates) => void;
  taskLocation: AttendanceCoordinates | null;
};
