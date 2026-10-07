import { dbProvider } from '@/zero/db-provider';
import { studioServerMutators } from '@/zero/communication-studio/server-mutators';
import { canvasCommandSchema } from '@/zero/communication-studio/commands';
import { createStudioClient } from '@/zero/communication-studio/useStudioClient';
import { studioQueries } from '@/zero/communication-studio/queries';
export function studioCanvasCommand(actor: string, input: any): Promise<any> {
  return dbProvider.transaction(async tx => {
    const ctx = { userID: actor, email: '' };
    const client = createStudioClient({
      context: ctx,
      run: (request: any) => tx.run(request.query.fn({ args: request.args, ctx })),
    } as never);
    if (input.action === 'session') return client.session(input);
    if (input.action === 'loadDraft') return client.loadDraft(input);
    if (input.action === 'libraries')
      return client.libraries({ groupId: (await client.session(input)).groupId });
    const args = canvasCommandSchema.parse(input);
    await studioServerMutators.canvas.command.fn({ tx, ctx, args });
    const receipt = await tx.run(
      studioQueries.canvasReceipt.fn({ ctx, args: { operationId: args.operationId } })
    );
    if (!receipt) throw new Error('Canvas receipt missing');
    return receipt.result;
  });
}
