import { lazy, Suspense, useEffect, useState } from 'react';
import { useTranslation } from '@/features/shared/hooks/use-translation';
import { ImageEditorDialog } from '@/features/file-upload/ui/ImageEditorDialog';
import { useStudioController } from '../hooks/useStudioController';
import { channels, fontFamilies, formats } from '../logic/document';
import { templateNames } from '../logic/templates';
import { CollaborationStatus } from '@/features/collaboration/ui/CollaborationStatus';
const Canvas = lazy(() => import('./StudioCanvas'));
const input = 'w-full rounded-md border bg-background px-2 py-1.5 text-sm';
const button = 'rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-40';
export function StudioWorkspace({
  groupId = null,
  projectId,
  open,
}: {
  groupId?: string | null;
  projectId?: string;
  open: (id: string) => void;
}) {
  const c = useStudioController(groupId, projectId, open);
  const { t } = useTranslation();
  const tr = (key: string) => t('features.studio.' + key);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const field = (label: string, children: React.ReactNode) => (
    <label key={label} className="block space-y-1 text-xs">
      <span>{tr(label)}</span>
      {children}
    </label>
  );
  const n = (label: string, key: string, value: number, min: number, max: number, step = 1) =>
    field(
      label,
      <input
        data-action-id="communication-studio.studioworkspace.activate.input-32634c553b"
        className={input}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => {
          const number = e.currentTarget.valueAsNumber;
          if (Number.isFinite(number) && number >= min && number <= max && c.active)
            c.patch(c.active.id, { [key]: number });
        }}
      />
    );
  const failure = c.failure || c.error;
  if (!projectId)
    return (
      <main className="mx-auto max-w-6xl space-y-8 p-4 md:p-8">
        <header>
          <p className="text-muted-foreground text-sm">{tr(groupId ? 'group' : 'personal')}</p>
          <h1 className="font-display text-4xl">{tr('title')}</h1>
          <p className="text-muted-foreground mt-2">{tr('subtitle')}</p>
        </header>
        {failure && (
          <p role="alert" className="text-destructive">
            {failure}
          </p>
        )}
        <section className="bg-card grid gap-6 rounded-xl border p-5 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">{tr('newProject')}</h2>
            <div className="flex gap-2">
              {(['template', 'ai'] as const).map(mode => (
                <button
                  data-action-id="communication-studio.studio-workspace.set-mode"
                  key={mode}
                  className={button}
                  aria-pressed={c.mode === mode}
                  onClick={() => c.setMode(mode)}
                >
                  {tr(mode)}
                </button>
              ))}
            </div>
            {field(
              'name',
              <input
                data-action-id="communication-studio.studioworkspace.activate.input-a4db323638"
                className={input}
                maxLength={200}
                value={c.title}
                onChange={e => c.setTitle(e.target.value)}
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              {field(
                'templateName',
                <select
                  data-action-id="communication-studio.studioworkspace.activate.select-c7ba71357a"
                  className={input}
                  value={c.kind}
                  onChange={e => c.setKind(e.target.value as typeof c.kind)}
                >
                  {['single', 'event', 'carousel', 'story', 'video', 'campaign'].map(k => (
                    <option key={k} value={k}>
                      {tr(k)}
                    </option>
                  ))}
                </select>
              )}
              {field(
                'template',
                <select
                  data-action-id="communication-studio.studioworkspace.activate.select-207aa77ea6"
                  className={input}
                  value={c.template}
                  onChange={e => c.setTemplate(e.target.value)}
                >
                  {templateNames.map(k => (
                    <option key={k} value={k}>
                      {tr(k)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="space-y-4">
            {c.kind === 'campaign' && (
              <div className="grid grid-cols-3 gap-2">
                {field(
                  'weeks',
                  <input
                    data-action-id="communication-studio.studioworkspace.activate.input-5aecf17a56"
                    className={input}
                    type="number"
                    min={1}
                    max={12}
                    value={c.weeks}
                    onChange={e => c.setWeeks(Math.max(1, Math.min(12, +e.target.value)))}
                  />
                )}
                {field(
                  'core',
                  <input
                    data-action-id="communication-studio.studioworkspace.activate.input-4bccd4d2f8"
                    className={input}
                    type="number"
                    min={1}
                    max={3}
                    value={c.core}
                    onChange={e => c.setCore(Math.max(1, Math.min(3, +e.target.value)))}
                  />
                )}
                {field(
                  'stories',
                  <input
                    data-action-id="communication-studio.studioworkspace.activate.input-04f17341d4"
                    className={input}
                    type="number"
                    min={0}
                    max={3}
                    value={c.stories}
                    onChange={e => c.setStories(Math.max(0, Math.min(3, +e.target.value)))}
                  />
                )}
              </div>
            )}
            {c.mode === 'ai' &&
              field(
                'brief',
                <textarea
                  data-action-id="communication-studio.studioworkspace.activate.textarea-52e4af57e4"
                  className={input}
                  rows={5}
                  value={c.brief}
                  onChange={e => c.setBrief(e.target.value)}
                />
              )}
            <button
              data-action-id="communication-studio.studio-workspace.create"
              className={button + ' bg-primary text-primary-foreground'}
              disabled={c.busy || !c.title.trim() || (c.mode === 'ai' && !c.brief.trim())}
              onClick={c.create}
            >
              {tr(c.busy ? 'busy' : 'create')}
            </button>
          </div>
        </section>
        <section>
          <h2 className="mb-4 text-xl font-semibold">{tr('projects')}</h2>
          {!c.projects.length && <p>{tr(c.isLoading ? 'loading' : 'empty')}</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.projects.map(p => (
              <button
                data-action-id="communication-studio.studio-workspace.open"
                key={p.id}
                className="bg-card hover:border-primary rounded-xl border p-5 text-left"
                onClick={() => open(p.id)}
              >
                <div className="mb-4 flex h-28 items-center justify-center rounded bg-[#12362D] font-serif text-xl text-[#FFFCF6]">
                  {p.title}
                </div>
                <span className="font-semibold">{p.title}</span>
                <p className="text-muted-foreground text-sm">
                  {tr(p.kind)}
                  {p.is_template ? ' · ' + tr('templateSaved') : ''}
                </p>
              </button>
            ))}
          </div>
        </section>
      </main>
    );
  if (!c.value || !c.page)
    return (
      <main className="p-8" role={failure ? 'alert' : 'status'}>
        {failure || tr('loading')}
      </main>
    );
  const { page, active, value, post } = c;
  const disabled = !c.canEdit || c.busy;
  const pageAssets = c.assets;
  return (
    <main className="space-y-3 p-2 md:p-4">
      {c.collaboration && <CollaborationStatus client={c.collaboration} />}
      <header className="flex flex-wrap items-center gap-3">
        <a
          data-action-id="communication-studio.studioworkspace.activate.a-dfa819da8b"
          className={button}
          href={groupId ? `/group/${groupId}/studio` : '/studio'}
        >
          {tr('projects')}
        </a>
        <input
          data-action-id="communication-studio.studioworkspace.activate.input-9338527e93"
          aria-label={tr('name')}
          className={input + ' max-w-sm font-semibold'}
          value={value.title}
          maxLength={200}
          disabled={!c.canEdit}
          onChange={e => c.meta('title', e.target.value)}
        />
        <span className="text-muted-foreground text-xs" role="status">
          {tr(c.status)}
        </span>
        <span className="text-xs">
          {c.peers
            .map(p => p.user?.name)
            .filter(Boolean)
            .join(' · ')}
        </span>
        <button
          data-action-id="communication-studio.studio-workspace.undo"
          className={button}
          onClick={c.undo}
          disabled={disabled}
        >
          {tr('undo')}
        </button>
        <button
          data-action-id="communication-studio.studio-workspace.redo"
          className={button}
          onClick={c.redo}
          disabled={disabled}
        >
          {tr('redo')}
        </button>
        <button
          data-action-id="communication-studio.studioworkspace.activate.button-3ed37cb5f3"
          className={button}
          onClick={() => c.run(() => c.actions.request('template', { id: projectId, value: true }))}
          disabled={disabled}
        >
          {tr('saveTemplate')}
        </button>
        <button
          data-action-id="communication-studio.studioworkspace.activate.button-141337c53d"
          className={button}
          disabled={c.busy}
          onClick={() =>
            c.run(async () => {
              const r = await c.actions.request<{ id: string }>('duplicate', { id: projectId });
              open(r.id);
            })
          }
        >
          {tr('duplicateProject')}
        </button>
      </header>
      {failure && (
        <p role="alert" className="border-destructive text-destructive rounded border p-3">
          {failure}
        </p>
      )}
      {!c.canEdit && <p>{tr('readOnly')}</p>}
      <div className="grid gap-3 lg:grid-cols-[180px_minmax(260px,1fr)_300px]">
        <aside className="max-h-[72vh] overflow-auto rounded-lg border p-2">
          <h2 className="mb-2 font-semibold">{tr('pages')}</h2>
          <div className="flex gap-2 overflow-auto lg:block lg:space-y-2">
            {value.pages.map((p, i) => (
              <button
                data-action-id="communication-studio.studioworkspace.activate.button-6182d65caf"
                key={p.id}
                className={
                  button +
                  ' shrink-0 text-left lg:w-full ' +
                  (p.id === page.id ? 'bg-primary/10 border-primary' : '')
                }
                onClick={() => {
                  c.setPageId(p.id);
                  c.select([]);
                }}
              >
                {i + 1}. {p.name.slice(0, 55)}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            <button
              data-action-id="communication-studio.studioworkspace.activate.button-0d5d4ff509"
              className={button}
              disabled={disabled}
              onClick={() => c.movePage(-1)}
            >
              {tr('pageUp')}
            </button>
            <button
              data-action-id="communication-studio.studioworkspace.activate.button-a1be62e947"
              className={button}
              disabled={disabled}
              onClick={() => c.movePage(1)}
            >
              {tr('pageDown')}
            </button>
            <button
              data-action-id="communication-studio.studio-workspace.insert-page"
              className={button}
              disabled={disabled}
              onClick={c.insertPage}
            >
              {tr('addPage')}
            </button>
            <button
              data-action-id="communication-studio.studio-workspace.duplicate-page"
              className={button}
              disabled={disabled}
              onClick={c.duplicatePage}
            >
              {tr('duplicate')}
            </button>
            <button
              data-action-id="communication-studio.studio-workspace.remove-page"
              className={button}
              disabled={disabled || value.pages.length === 1}
              onClick={c.removePage}
            >
              {tr('remove')}
            </button>
          </div>
        </aside>
        <section className="bg-muted/30 min-w-0 rounded-lg border">
          <div className="flex flex-wrap gap-1 border-b p-2">
            {(['text', 'rect', 'ellipse'] as const).map(type => (
              <button
                data-action-id="communication-studio.studio-workspace.add"
                key={type}
                className={button}
                disabled={disabled}
                onClick={() => c.add(type)}
              >
                {tr(type)}
              </button>
            ))}
            <label className={button + ' cursor-pointer'}>
              {tr('upload')}
              <input
                data-action-id="communication-studio.studioworkspace.activate.input-db68506611"
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/webp,video/mp4"
                disabled={disabled}
                onChange={e => {
                  if (e.target.files?.[0]) void c.upload(e.target.files[0]);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              data-action-id="communication-studio.studio-workspace.duplicate-selected"
              className={button}
              disabled={disabled || !c.selected.length}
              onClick={c.duplicateSelected}
            >
              {tr('duplicate')}
            </button>
            <button
              data-action-id="communication-studio.studio-workspace.delete-selected"
              className={button}
              disabled={disabled || !c.selected.length}
              onClick={c.deleteSelected}
            >
              {tr('remove')}
            </button>
            <button
              data-action-id="communication-studio.studio-workspace.group-selected"
              className={button}
              disabled={disabled || c.selected.length < 2}
              onClick={c.groupSelected}
            >
              {tr('groupElements')}
            </button>
            <button
              data-action-id="communication-studio.studio-workspace.ungroup"
              className={button}
              disabled={disabled || !c.selected.length}
              onClick={c.ungroup}
            >
              {tr('ungroup')}
            </button>
            <button
              data-action-id="communication-studio.studio-workspace.align"
              className={button}
              disabled={disabled || !c.selected.length}
              onClick={c.align}
            >
              {tr('align')}
            </button>
          </div>
          {mounted && (
            <Suspense fallback={<p className="p-8">{tr('loading')}</p>}>
              <Canvas
                page={page}
                assets={pageAssets}
                selected={c.selected}
                select={c.select}
                patch={c.patch}
                editable={c.canEdit}
                peers={c.peers}
                cursor={(x, y) => c.cursor(page.id, x, y)}
                playing={c.playing}
                time={c.time}
                guides={c.guides}
              />
            </Suspense>
          )}
          <div className="flex items-center gap-3 p-3">
            <button
              data-action-id="communication-studio.studio-workspace.set-playing"
              className={button}
              onClick={() => c.setPlaying(!c.playing)}
            >
              {tr(c.playing ? 'stop' : 'preview')}
            </button>
            <label className="text-sm">
              <input
                data-action-id="communication-studio.studioworkspace.activate.input-f7d0660f32"
                type="checkbox"
                checked={c.guides}
                onChange={e => c.setGuides(e.target.checked)}
              />{' '}
              {tr('guides')}
            </label>
          </div>
        </section>
        <aside className="max-h-[82vh] space-y-4 overflow-auto rounded-lg border p-3">
          <fieldset disabled={!c.canEdit} className="space-y-3">
            <legend className="font-semibold">{tr('properties')}</legend>
            {field(
              'name',
              <input
                data-action-id="communication-studio.studioworkspace.activate.input-9c30e00289"
                className={input}
                value={page.name}
                maxLength={160}
                onChange={e => c.patchPage(page.id, { name: e.target.value })}
              />
            )}
            <div className="grid grid-cols-2 gap-2">
              {field(
                'background',
                <input
                  data-action-id="communication-studio.studioworkspace.activate.input-f15ecea43d"
                  className={input}
                  type="color"
                  value={page.background}
                  onChange={e => c.patchPage(page.id, { background: e.target.value })}
                />
              )}
              {field(
                'duration',
                <input
                  data-action-id="communication-studio.studioworkspace.activate.input-635c870eb9"
                  className={input}
                  type="number"
                  min={1}
                  max={60}
                  value={page.duration}
                  onChange={e => {
                    const otherDuration =
                      c.post?.kind === 'video'
                        ? value.pages
                            .filter(p => p.id !== page.id && c.post?.pageIds.includes(p.id))
                            .reduce((n, p) => n + p.duration, 0)
                        : 0;
                    if (+e.target.value >= 1 && +e.target.value + otherDuration <= 60)
                      c.patchPage(page.id, { duration: +e.target.value });
                  }}
                />
              )}
            </div>
            <select
              data-action-id="communication-studio.studioworkspace.activate.format"
              aria-label={tr('format')}
              className={input}
              value={page.format}
              onChange={e => c.changeFormat(e.target.value as typeof page.format)}
            >
              {Object.entries(formats).map(([key, size]) => (
                <option key={key} value={key}>
                  {key} · {size.join(' × ')}
                </option>
              ))}
            </select>
            {field(
              'transition',
              <select
                data-action-id="communication-studio.studioworkspace.activate.select-97008fc688"
                className={input}
                value={page.transition}
                onChange={e =>
                  c.patchPage(page.id, { transition: e.target.value as typeof page.transition })
                }
              >
                <option value="none">{tr('none')}</option>
                <option value="fade">{tr('fade')}</option>
              </select>
            )}
            {active && (
              <>
                <hr />
                {active.type === 'text' && (
                  <>
                    {field(
                      'text',
                      <textarea
                        data-action-id="communication-studio.studioworkspace.activate.textarea-dcebf42594"
                        className={input}
                        rows={5}
                        value={active.text}
                        maxLength={10000}
                        onChange={e => c.patch(active.id, { text: e.target.value })}
                      />
                    )}
                    {field(
                      'font',
                      <select
                        data-action-id="communication-studio.studioworkspace.activate.select-4d0cd79d46"
                        className={input}
                        value={active.font}
                        onChange={e =>
                          c.patch(active.id, { font: e.target.value as typeof active.font })
                        }
                      >
                        {fontFamilies.map(f => (
                          <option key={f}>{f}</option>
                        ))}
                      </select>
                    )}
                    {field(
                      'alignment',
                      <select
                        data-action-id="communication-studio.studioworkspace.activate.select-515683ba65"
                        className={input}
                        value={active.align}
                        onChange={e =>
                          c.patch(active.id, { align: e.target.value as typeof active.align })
                        }
                      >
                        {['left', 'center', 'right'].map(a => (
                          <option key={a} value={a}>
                            {tr(a)}
                          </option>
                        ))}
                      </select>
                    )}
                    <label className="block">
                      <input
                        data-action-id="communication-studio.studioworkspace.activate.input-f7078e4db3"
                        type="checkbox"
                        checked={active.bold}
                        onChange={e => c.patch(active.id, { bold: e.target.checked })}
                      />{' '}
                      {tr('bold')}
                    </label>
                  </>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {n('X', 'x', active.x, -4000, 4000)}
                  {n('Y', 'y', active.y, -4000, 4000)}
                  {n('width', 'width', active.width, 4, 5000)}
                  {n('height', 'height', active.height, 4, 5000)}
                  {n('rotation', 'rotation', active.rotation, -360, 360)}
                  {n('opacity', 'opacity', active.opacity, 0, 1, 0.05)}
                  {n('order', 'order', active.order, -100, 1000)}
                  {active.type === 'text' && n('fontSize', 'fontSize', active.fontSize, 8, 300)}
                  {field(
                    'color',
                    <input
                      data-action-id="communication-studio.studioworkspace.activate.input-f891eec816"
                      type="color"
                      className={input}
                      value={active.fill}
                      onChange={e => c.patch(active.id, { fill: e.target.value })}
                    />
                  )}
                </div>
                <label className="block">
                  <input
                    data-action-id="communication-studio.studioworkspace.activate.input-70799f297e"
                    type="checkbox"
                    checked={active.locked}
                    onChange={e => c.patch(active.id, { locked: e.target.checked })}
                  />{' '}
                  {tr('locked')}
                </label>
                {field(
                  'animation',
                  <select
                    data-action-id="communication-studio.studioworkspace.activate.select-74119eaeb9"
                    className={input}
                    value={active.animation}
                    onChange={e =>
                      c.patch(active.id, { animation: e.target.value as 'none' | 'fade' })
                    }
                  >
                    <option value="none">{tr('none')}</option>
                    <option value="fade">{tr('fade')}</option>
                  </select>
                )}
                {(active.type === 'image' || active.type === 'video') && (
                  <>
                    {field(
                      'fit',
                      <select
                        data-action-id="communication-studio.studioworkspace.activate.select-1408e711cc"
                        className={input}
                        value={active.fit}
                        onChange={e =>
                          c.patch(active.id, { fit: e.target.value as 'cover' | 'contain' })
                        }
                      >
                        <option value="contain">{tr('contain')}</option>
                        <option value="cover">{tr('cover')}</option>
                      </select>
                    )}
                    {n('cropX', 'cropX', active.cropX, 0, 1, 0.05)}
                    {n('cropY', 'cropY', active.cropY, 0, 1, 0.05)}
                  </>
                )}
                {active.type === 'video' && (
                  <>
                    {n('trim', 'trimStart', active.trimStart, 0, 3600)}
                    <label>
                      <input
                        data-action-id="communication-studio.studioworkspace.activate.input-f95d891276"
                        type="checkbox"
                        checked={active.muted}
                        onChange={e => c.patch(active.id, { muted: e.target.checked })}
                      />{' '}
                      {tr('muted')}
                    </label>
                  </>
                )}
                {active.type === 'image' && (
                  <>
                    <button
                      data-action-id="communication-studio.studio-workspace.set-photo-edit"
                      className={button}
                      onClick={() =>
                        c.setPhotoEdit(c.assets.find(a => a.id === active.assetId)?.url)
                      }
                    >
                      {tr('editImage')}
                    </button>
                    <button
                      data-action-id="communication-studio.studio-workspace.apply-logo"
                      className={button}
                      onClick={c.applyLogo}
                    >
                      {tr('logo')}
                    </button>
                  </>
                )}
              </>
            )}
          </fieldset>
          <details>
            <summary>{tr('brand')}</summary>
            <div className="space-y-2 py-2">
              {(['background', 'foreground', 'accent'] as const).map(key => (
                <label key={key} className="flex gap-2 text-sm">
                  <input
                    data-action-id="communication-studio.studioworkspace.activate.input-e77fb67ee7"
                    type="color"
                    disabled={!c.canEdit}
                    value={value.brand[key]}
                    onChange={e => c.updateBrand({ ...value.brand, [key]: e.target.value })}
                  />
                  {key}
                </label>
              ))}
              {c.themes.map(theme => (
                <button
                  data-action-id="communication-studio.studioworkspace.activate.button-33414fbc81"
                  key={theme.id}
                  className={button}
                  disabled={!c.canEdit}
                  onClick={() => c.applyTheme(theme)}
                >
                  {tr('theme')}: {theme.name}
                </button>
              ))}
              {groupId && (
                <a
                  data-action-id="communication-studio.studioworkspace.activate.a-983295b263"
                  className="block underline"
                  href={`/group/${groupId}/settings?tab=themes`}
                >
                  {tr('editThemes')}
                </a>
              )}
            </div>
          </details>
          <details>
            <summary>{tr('sources')}</summary>
            <select
              data-action-id="communication-studio.studioworkspace.activate.select-8e6f883574"
              aria-label={tr('sources')}
              className={input}
              value={c.sourceType}
              onChange={e => c.setSourceType(e.target.value as typeof c.sourceType)}
            >
              {['event', 'amendment', 'statement'].map(v => (
                <option key={v} value={v}>
                  {tr(v)}
                </option>
              ))}
            </select>
            <button
              data-action-id="communication-studio.studio-workspace.load-sources"
              className={button}
              onClick={c.loadSources}
            >
              {tr('loadSources')}
            </button>
            {c.sources.map(source => (
              <button
                data-action-id="communication-studio.studio-workspace.source"
                key={source.id}
                className={button + ' w-full text-left'}
                disabled={disabled}
                onClick={() => c.source(source)}
              >
                {source.title}
              </button>
            ))}
          </details>
          <details>
            <summary>{tr('ai')}</summary>
            {field(
              'brief',
              <textarea
                data-action-id="communication-studio.studioworkspace.activate.textarea-87fab7971d"
                className={input}
                rows={4}
                value={c.brief}
                onChange={e => c.setBrief(e.target.value)}
              />
            )}
            <button
              data-action-id="communication-studio.studio-workspace.ai"
              className={button}
              disabled={disabled || !c.brief.trim()}
              onClick={c.ai}
            >
              {tr('generate')}
            </button>
            {c.proposal && (
              <div className="space-y-2">
                <div className="max-h-72 space-y-4 overflow-auto text-sm">
                  {c.proposal.posts.map((post, index) => (
                    <article key={index} className="space-y-2 rounded border p-2">
                      <strong>{post.title}</strong>
                      {post.slides.map((slide, i) => (
                        <p key={i}>
                          <b>{slide.title}</b>
                          <br />
                          {slide.text}
                        </p>
                      ))}
                      <p>{post.action}</p>
                    </article>
                  ))}
                </div>
                <button
                  data-action-id="communication-studio.studio-workspace.accept-ai"
                  className={button}
                  onClick={c.acceptAI}
                >
                  {tr('accept')}
                </button>
                <button
                  data-action-id="communication-studio.studio-workspace.set-proposal"
                  className={button}
                  onClick={() => c.setProposal(null)}
                >
                  {tr('discard')}
                </button>
              </div>
            )}
          </details>
        </aside>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-semibold">{tr('captions')}</h2>
          {post && (
            <fieldset disabled={!c.canEdit} className="space-y-2">
              {field(
                'action',
                <input
                  data-action-id="communication-studio.studioworkspace.activate.input-196201b86b"
                  className={input}
                  value={post.action}
                  onChange={e => c.patchPost(post.id, { action: e.target.value })}
                />
              )}
              {channels.map(channel =>
                field(
                  channel,
                  <textarea
                    data-action-id="communication-studio.studioworkspace.activate.textarea-c86d94bab4"
                    key={channel}
                    className={input}
                    rows={3}
                    value={post.captions[channel]}
                    onChange={e =>
                      c.patchPost(post.id, {
                        captions: { [channel]: e.target.value },
                      })
                    }
                  />
                )
              )}
            </fieldset>
          )}
          {value.kind === 'campaign' && (
            <>
              {field(
                'startDate',
                <input
                  data-action-id="communication-studio.studioworkspace.activate.input-08551745f9"
                  className={input}
                  type="date"
                  disabled={!c.canEdit}
                  value={value.startDate}
                  onChange={e => c.meta('startDate', e.target.value)}
                />
              )}
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th>{tr('name')}</th>
                      <th>{tr('day')}</th>
                      <th>{tr('status')}</th>
                      <th>{tr('assignee')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {value.posts.map(p => (
                      <tr key={p.id}>
                        <td>
                          <button
                            data-action-id="communication-studio.studioworkspace.activate.button-34e4cc1616"
                            onClick={() => c.setPageId(p.pageIds[0])}
                          >
                            {p.code} · {p.title}
                          </button>
                        </td>
                        <td>
                          <input
                            data-action-id="communication-studio.studioworkspace.activate.input-3f9842a2bc"
                            aria-label={tr('day')}
                            className={input}
                            disabled={!c.canEdit}
                            type="number"
                            min={0}
                            max={365}
                            value={p.day}
                            onChange={e =>
                              c.patchPost(p.id, {
                                day: Math.max(0, Math.min(365, +e.target.value)),
                              })
                            }
                          />
                        </td>
                        <td>
                          <select
                            data-action-id="communication-studio.studioworkspace.activate.select-335fe1f170"
                            aria-label={tr('status')}
                            className={input}
                            disabled={!c.canEdit}
                            value={p.status}
                            onChange={e =>
                              c.patchPost(p.id, { status: e.target.value as typeof p.status })
                            }
                          >
                            {['draft', 'ready', 'published'].map(s => (
                              <option value={s} key={s}>
                                {tr(s)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            data-action-id="communication-studio.studioworkspace.activate.input-ef4bdcdc59"
                            aria-label={tr('assignee')}
                            className={input}
                            disabled={!c.canEdit}
                            value={p.assignee}
                            onChange={e => c.patchPost(p.id, { assignee: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-semibold">{tr('exports')}</h2>
          <div className="flex flex-wrap gap-2">
            <select
              data-action-id="communication-studio.studioworkspace.activate.format-2"
              className={input + ' max-w-32'}
              aria-label={tr('format')}
              value={c.format}
              onChange={e => c.setFormat(e.target.value)}
            >
              {['png', 'pdf', 'pptx', 'canva', 'mp4', 'xlsx', 'zip'].map(f => (
                <option key={f} value={f}>
                  {f.toUpperCase()}
                </option>
              ))}
            </select>
            <select
              data-action-id="communication-studio.studioworkspace.activate.select-ba740cd21e"
              className={input + ' max-w-52'}
              aria-label={tr('scope')}
              value={c.scope}
              onChange={e => c.setScope(e.target.value)}
            >
              {['page', 'post', 'all'].map(s => (
                <option key={s} value={s}>
                  {tr(s)}
                </option>
              ))}
            </select>
            <button
              data-action-id="communication-studio.studio-workspace.export-media"
              className={button}
              disabled={disabled || c.status === 'offline'}
              onClick={c.exportMedia}
            >
              {tr('export')}
            </button>
          </div>
          <p className="text-muted-foreground text-xs">
            {tr(c.format === 'canva' ? 'canvaHint' : 'exportHint')}
          </p>
          {c.exports.map(job => (
            <div key={job.id} className="rounded border p-2 text-sm">
              <div className="flex items-center gap-3">
                <span>
                  {job.format.toUpperCase()} · {tr(job.status)} · {job.progress}%
                </span>
                {job.status === 'completed' ? (
                  <>
                    <button
                      data-action-id="communication-studio.studioworkspace.activate.button-fdbeb1cd6b"
                      className={button}
                      onClick={() =>
                        c.run(async () => {
                          const result = await c.actions.request<{ url: string }>('download', {
                            id: job.id,
                          });
                          window.open(result.url, '_blank', 'noopener,noreferrer');
                        })
                      }
                    >
                      {tr('download')}
                    </button>
                    {(job.format === 'png' || job.format === 'mp4') && (
                      <button
                        data-action-id="communication-studio.studioworkspace.activate.button-07f95dca6d"
                        className={button}
                        disabled={disabled}
                        onClick={() =>
                          c.run(async () => {
                            const result = await c.actions.request<any>('handoff', { id: job.id });
                            sessionStorage.setItem(
                              'studio:post',
                              JSON.stringify({ ...result, groupId, title: value.title, projectId })
                            );
                            window.location.assign(
                              '/create/statement' + (groupId ? '?groupId=' + groupId : '')
                            );
                          })
                        }
                      >
                        {tr('usePost')}
                      </button>
                    )}
                  </>
                ) : (
                  ['queued', 'running'].includes(job.status) && (
                    <button
                      data-action-id="communication-studio.studioworkspace.activate.button-f159baea82"
                      className={button}
                      disabled={disabled}
                      onClick={() => c.run(() => c.actions.request('cancel', { id: job.id }))}
                    >
                      {tr('cancel')}
                    </button>
                  )
                )}
              </div>
              {job.error && <p role="alert">{job.error}</p>}
            </div>
          ))}
        </section>
      </div>
      <ImageEditorDialog
        imageUrl={c.photoEdit}
        open={!!c.photoEdit}
        onOpenChange={open => {
          if (!open) c.setPhotoEdit(undefined);
        }}
        onSave={async file => (await c.savePhoto(file)) ?? false}
      />
    </main>
  );
}
