import { useLocalSearchParams } from 'expo-router';

import { RecordFormScreen } from '@/features/records/RecordFormScreen';

export default function RecordEditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecordFormScreen recordId={id ?? ''} />;
}
