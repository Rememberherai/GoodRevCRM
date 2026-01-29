import { SchemaManagerClient } from './schema-manager-client';

export const metadata = {
  title: 'Schema Manager',
  description: 'Manage custom fields for your entities',
};

export default function SchemaManagerPage() {
  return <SchemaManagerClient />;
}
