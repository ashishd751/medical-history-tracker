import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useState } from 'react';

import { AppTabBar } from '@/features/navigation/AppTabBar';
import { AddSheetContent } from '@/features/records/AddSheetContent';
import { AppSheet, strings } from '@/ui';

/**
 * The tab shell. The add sheet lives here because both the centre button and (later) other
 * shortcuts open the same sheet, and only route files may import two features at once.
 */
export default function TabsLayout() {
  const [addOpen, setAddOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <AppTabBar {...props} onAddPress={() => setAddOpen(true)} />}
      >
        <Tabs.Screen name="home" options={{ title: strings.tabs.home }} />
        <Tabs.Screen name="records" options={{ title: strings.tabs.records }} />
        <Tabs.Screen name="profile" options={{ title: strings.tabs.profile }} />
        <Tabs.Screen name="settings" options={{ title: strings.tabs.settings }} />
      </Tabs>

      <AppSheet
        visible={addOpen}
        onDismiss={() => setAddOpen(false)}
        title={strings.addSheet.title}
        testID="add-sheet"
      >
        <AddSheetContent
          onManual={() => {
            setAddOpen(false);
            router.push('/record/new');
          }}
        />
      </AppSheet>
    </>
  );
}
