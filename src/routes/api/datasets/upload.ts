import { createFileRoute } from '@tanstack/react-router';
import { getSession } from '@/lib/supabase/server';
import { parseDatasetCsv } from '@/server/datasets/csv';
import { persistDatasetSnapshot } from '@/server/datasets/service';
import { assertDatasetSize, bytesToText } from '@/server/datasets/storage';
import { loadDatasetContributionGroupName } from '@/server/datasets/access';
import { appErrorHttpBody, appErrorHttpBodyFrom } from '@/features/shared/errors/app-error';

export const Route = createFileRoute('/api/datasets/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getSession(request);
        if (!session?.user) {
          return Response.json(appErrorHttpBody('permission_denied'), { status: 401 });
        }

        try {
          const formData = await request.formData();
          const file = formData.get('file');
          const groupId = String(formData.get('groupId') ?? '').trim();
          const title = String(formData.get('title') ?? '').trim();
          const description = String(formData.get('description') ?? '').trim();

          if (!(file instanceof File)) {
            return Response.json(appErrorHttpBody('validation_failed'), { status: 400 });
          }
          if (!groupId) {
            return Response.json(appErrorHttpBody('validation_failed'), { status: 400 });
          }
          assertDatasetSize(file.size, 'Uploaded dataset');

          const publisher = await loadDatasetContributionGroupName(session.user.id, groupId);
          const uploadedAt = new Date().toISOString();
          const bytes = new Uint8Array(await file.arrayBuffer());
          assertDatasetSize(bytes.byteLength, 'Uploaded dataset');
          const table = parseDatasetCsv(bytesToText(bytes));
          const result = await persistDatasetSnapshot({
            provider: 'UPLOAD',
            providerDatasetId: file.name,
            providerResourceId: crypto.randomUUID(),
            title: title || file.name,
            description: description || null,
            publisher,
            sourceUrl: null,
            metadata: {
              fileName: file.name,
              fileType: file.type || null,
              uploadedAt,
            },
            visibility: 'private',
            groupId,
            createdById: session.user.id,
            snapshotTakenAt: uploadedAt,
            table,
          });

          return Response.json(result);
        } catch (error) {
          return Response.json(appErrorHttpBodyFrom(error, 'upload_failed'), { status: 400 });
        }
      },
    },
  },
});
