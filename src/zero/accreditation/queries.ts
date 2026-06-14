import { defineQuery } from '@rocicorp/zero';
import { z } from 'zod';
import { applyAccreditationQueryAccess } from '../rbac/query-access';
import { zql } from '../schema';

export const accreditationQueries = {
  // All accreditations for an event
  accreditationsByEvent: defineQuery(
    z.object({ event_id: z.string() }),
    ({ args: { event_id }, ctx: { userID } }) =>
      applyAccreditationQueryAccess(zql.accreditation.where('event_id', event_id), userID).related(
        'user'
      )
  ),

  // User's accreditation for an event
  userAccreditation: defineQuery(
    z.object({ event_id: z.string(), user_id: z.string() }),
    ({ args: { event_id, user_id }, ctx: { userID } }) =>
      zql.accreditation
        .where('event_id', event_id)
        .where('user_id', user_id)
        .where('user_id', userID)
        .one()
  ),

  // All accreditations for an agenda item
  accreditationsByAgendaItem: defineQuery(
    z.object({ agenda_item_id: z.string() }),
    ({ args: { agenda_item_id }, ctx: { userID } }) =>
      applyAccreditationQueryAccess(
        zql.accreditation.where('agenda_item_id', agenda_item_id),
        userID
      ).related('user')
  ),
};
