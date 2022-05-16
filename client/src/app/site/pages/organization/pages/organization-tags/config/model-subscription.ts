import { ViewOrganization } from 'src/app/site/pages/organization/view-models/view-organization';
import { ORGANIZATION_ID } from 'src/app/site/pages/organization/services/organization.service';
import { ViewOrganizationTag } from '../view-models';
import { Id } from 'src/app/domain/definitions/key-types';
import { map, Observable } from 'rxjs';

export const ORGANIZATION_TAG_LIST_SUBSCRIPTION = `organization_tag_list`;

export const getOrganizationTagListSubscriptionConfig = (getNextMeetingIdObservable: () => Observable<Id | null>) => ({
    subscriptionName: ORGANIZATION_TAG_LIST_SUBSCRIPTION,
    modelRequest: {
        viewModelCtor: ViewOrganization,
        ids: [ORGANIZATION_ID],
        follow: [`organization_tag_ids`]
    },
    hideWhen: getNextMeetingIdObservable().pipe(map(id => !!id))
});
