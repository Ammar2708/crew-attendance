export type EmployeeProfile = {
  id: string;
  full_name: string;
  role: 'employee' | 'owner';
  is_active: boolean;
};

export type Task = {
  id: string;
  title: string;
  site_address: string;
  assigned_to: string;
  assigned_by: string;
  status: string;
  due_date: string | null;
  created_at: string;
};
