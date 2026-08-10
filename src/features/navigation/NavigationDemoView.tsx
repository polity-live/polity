import { BadgeControl } from '@/features/shared/ui/status';
import { Button } from '@/features/shared/ui/ui/button.tsx';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/features/shared/ui/ui/card.tsx';
import { ThemeToggle } from '@/features/navigation/toggles/theme-toggle.tsx';
import { Search } from 'lucide-react';
import { translate as translateText } from '@/features/shared/hooks/use-translation';

export interface NavigationDemoViewProps {
  onScreenTypeChange: any;
  onPriorityChange: any;
  t: any;
  isMobile: any;
  screenType: any;
  setScreenType: any;
  actualScreen: any;
  setActualScreen: any;
  priority: any;
  setPriority: any;
  handleScreenTypeChange: any;
  handlePriorityChange: any;
}

export function NavigationDemoView({
  t,
  screenType,
  actualScreen,
  priority,
  handleScreenTypeChange,
  handlePriorityChange,
}: NavigationDemoViewProps) {
  return (
    <div className="container mx-auto p-8">
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t('navigationDemo.title')}</CardTitle>
            <CardDescription>{t('navigationDemo.description')}</CardDescription>
          </div>
          <ThemeToggle />
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="mb-3 text-lg font-medium">{t('navigationDemo.screenType.title')}</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={screenType === 'mobile' ? 'default' : 'outline'}
                onClick={() => handleScreenTypeChange('mobile')}
                data-action-id="navigation.demo.screen.mobile"
              >
                {t('navigationDemo.screenType.mobile')}
              </Button>
              <Button
                variant={screenType === 'desktop' ? 'default' : 'outline'}
                onClick={() => handleScreenTypeChange('desktop')}
                data-action-id="navigation.demo.screen.desktop"
              >
                {t('navigationDemo.screenType.desktop')}
              </Button>
              <Button
                variant={screenType === 'automatic' ? 'default' : 'outline'}
                onClick={() => handleScreenTypeChange('automatic')}
                data-action-id="navigation.demo.screen.automatic"
              >
                {t('navigationDemo.screenType.automatic')}
              </Button>
            </div>
            <div className="text-muted-foreground mt-2 flex items-center text-sm">
              <BadgeControl variant="outline" className="mr-2">
                {screenType}
              </BadgeControl>
              <span>{t('navigationDemo.screenType.description')}</span>
            </div>
          </div>
          <div className="border-t pt-4">
            <h3 className="mb-3 text-lg font-medium">{t('navigationDemo.commandPalette.title')}</h3>
            <div>
              <div className="text-muted-foreground flex w-full justify-start rounded-md border px-4 py-2 text-sm">
                <Search className="mr-2 h-4 w-4" />
                <span>{t('navigationDemo.commandPalette.placeholder')}</span>
                <kbd className="bg-muted text-muted-foreground pointer-events-none ml-auto inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
            </div>
          </div>
          <div className="border-t pt-4">
            <h3 className="mb-3 text-lg font-medium">{t('navigationDemo.themeSettings.title')}</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">
                  {t('navigationDemo.themeSettings.description')}
                </p>
              </div>
              <ThemeToggle />
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-lg font-medium">{t('navigationDemo.priority.title')}</h3>
            <div className="flex gap-2">
              <Button
                variant={priority === 'primary' ? 'default' : 'outline'}
                onClick={() => handlePriorityChange('primary')}
                data-action-id="navigation.demo.priority.primary"
              >
                {t('navigationDemo.priority.primary')}
              </Button>
              <Button
                variant={priority === 'secondary' ? 'default' : 'outline'}
                onClick={() => handlePriorityChange('secondary')}
                data-action-id="navigation.demo.priority.secondary"
              >
                {t('navigationDemo.priority.secondary')}
              </Button>
              <Button
                variant={priority === 'combined' ? 'default' : 'outline'}
                onClick={() => handlePriorityChange('combined')}
                data-action-id="navigation.demo.priority.combined"
              >
                {t('navigationDemo.priority.combined')}
              </Button>
            </div>
          </div>
          <div className="border-t pt-4">
            <h3 className="mb-3 text-lg font-medium">{t('navigationDemo.currentConfig.title')}</h3>
            <div className="flex flex-wrap gap-2">
              <BadgeControl variant="secondary">
                {t('navigationDemo.currentConfig.state')}
                {translateText('generated.inline.0754_asbutton_0e7e9874')}
              </BadgeControl>
              <BadgeControl variant="secondary">
                {t('navigationDemo.currentConfig.priority')}: {priority}
              </BadgeControl>
              <BadgeControl variant="secondary">
                {t('navigationDemo.currentConfig.screen')}: {actualScreen}
              </BadgeControl>
            </div>
          </div>
          <div className="border-t pt-4">
            <h3 className="mb-3 text-lg font-medium">{t('navigationDemo.stateSwitcher.title')}</h3>
            <div className="text-muted-foreground space-y-2 text-sm">
              <p>
                <strong>{t('navigationDemo.stateSwitcher.asButton.title')}</strong>
                {t('navigationDemo.stateSwitcher.asButton.description')}
              </p>
              <p>
                <strong>{t('navigationDemo.stateSwitcher.asButtonList.title')}</strong>
                {t('navigationDemo.stateSwitcher.asButtonList.description')}
              </p>
              <p>
                <strong>{t('navigationDemo.stateSwitcher.asLabeledButtonList.title')}</strong>
                {t('navigationDemo.stateSwitcher.asLabeledButtonList.description')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_: any, i: number) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle>
                {t('navigationDemo.sampleContent.title')} {i + 1}
              </CardTitle>
              <CardDescription>{t('navigationDemo.sampleContent.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                {t('navigationDemo.sampleContent.content')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
