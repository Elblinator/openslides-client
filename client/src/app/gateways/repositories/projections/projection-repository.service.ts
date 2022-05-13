import { Injectable } from '@angular/core';
import { Projection } from 'src/app/domain/models/projector/projection';
import { ViewProjection } from 'src/app/site/pages/meetings/pages/projectors';
import { DEFAULT_FIELDSET, Fieldsets } from 'src/app/site/services/model-request-builder';
import { BaseMeetingRelatedRepository } from '../base-meeting-related-repository';
import { RepositoryMeetingServiceCollectorService } from '../repository-meeting-service-collector.service';
import { ProjectionAction } from './projection.action';
import { Identifiable } from 'src/app/domain/interfaces';

@Injectable({
    providedIn: 'root'
})
export class ProjectionRepositoryService extends BaseMeetingRelatedRepository<ViewProjection, Projection> {
    public constructor(repositoryServiceCollector: RepositoryMeetingServiceCollectorService) {
        super(repositoryServiceCollector, Projection);
    }

    public getVerboseName = (plural: boolean = false) => this.translate.instant(plural ? `Projections` : `Projection`);

    public getTitle = (viewProjection: ViewProjection) =>
        viewProjection.content_object?.getProjectorTitle(viewProjection.projection).title;

    public getSubtitle = (viewProjection: ViewProjection) =>
        viewProjection.content_object?.getProjectorTitle(viewProjection.projection).subtitle || ``;

    public override getFieldsets(): Fieldsets<Projection> {
        const defaultKeys: (keyof Projection)[] = [
            `stable`,
            `type`,
            `options`,
            `weight`,
            `content_object_id`,
            `preview_projector_id`,
            `current_projector_id`,
            `history_projector_id`,
            `content`,
            `current_projector_id`
        ];
        return { [DEFAULT_FIELDSET]: defaultKeys };
    }

    public async updateOption(projection: ViewProjection): Promise<void> {
        const payload = {
            id: projection.id,
            options: projection.options
        };
        return await this.sendActionToBackend(ProjectionAction.UPDATE_OPTIONS, payload);
    }

    /**
     * Deletes projections. They can only be deleted, if they are a current or preview projection.
     */
    public delete(...projections: Identifiable[]): Promise<void> {
        return this.sendBulkActionToBackend(
            ProjectionAction.DELETE,
            projections.map(projection => ({ id: projection.id }))
        );
    }

    protected override createViewModel(model: Projection): ViewProjection {
        const viewModel = super.createViewModel(model);
        viewModel.getSubtitle = () => this.getSubtitle(viewModel);
        return viewModel;
    }
}
