/**
 * First stop: decide between onboarding and Home.
 *
 * The redirect keeps route files thin — every screen lives in a feature.
 */
import { Redirect } from 'expo-router';

import { userMessage } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { AppEmptyState, AppScreen, AppText, strings } from '@/ui';

export default function IndexScreen() {
  const { ready, error, onboarded, personId } = useSession();

  if (error) {
    return (
      <AppScreen title={strings.app.name} testID="boot-error">
        <AppEmptyState title={strings.errors.unknown} message={userMessage(error)} />
      </AppScreen>
    );
  }

  if (!ready) {
    return (
      <AppScreen title={strings.app.name}>
        <AppText variant="body" color="muted">
          {strings.common.loading}
        </AppText>
      </AppScreen>
    );
  }

  if (!onboarded || !personId) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/home" />;
}
