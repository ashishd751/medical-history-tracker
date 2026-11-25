import { useLocalSearchParams } from 'expo-router';

import { RecordDetailScreen } from '@/features/records/RecordDetailScreen';

export default function RecordDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecordDetailScreen recordId={id ?? ''} />;
}
