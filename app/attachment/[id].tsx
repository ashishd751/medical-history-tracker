/**
 * The attachment viewer route. Route files only wire a screen to a feature.
 */
import { useLocalSearchParams } from 'expo-router';

import { AttachmentViewerScreen } from '@/features/records/attachments/AttachmentViewerScreen';

export default function AttachmentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AttachmentViewerScreen attachmentId={typeof id === 'string' ? id : ''} />;
}
