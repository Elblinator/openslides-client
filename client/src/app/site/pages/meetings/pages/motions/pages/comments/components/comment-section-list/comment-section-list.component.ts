import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { BehaviorSubject, Observable } from 'rxjs';
import { BaseComponent } from 'src/app/site/base/base.component';
import { ViewMotionCommentSection } from 'src/app/site/pages/meetings/pages/motions';
import { ViewGroup } from 'src/app/site/pages/meetings/pages/participants';
import { MotionCommentSectionControllerService } from '../../../../modules/comments/services';
import { TranslateService } from '@ngx-translate/core';
import { ComponentServiceCollectorService } from 'src/app/site/services/component-service-collector.service';
import { PromptService } from 'src/app/ui/modules/prompt-dialog';
import { GroupControllerService } from 'src/app/site/pages/meetings/pages/participants/modules';
import { infoDialogSettings } from 'src/app/infrastructure/utils/dialog-settings';
import { MotionCommentSection } from 'src/app/domain/models/motions/motion-comment-section';
import { Identifiable } from 'src/app/domain/interfaces';
import { marker as _ } from '@biesbjerg/ngx-translate-extract-marker';

@Component({
    selector: 'os-comment-section-list',
    templateUrl: './comment-section-list.component.html',
    styleUrls: ['./comment-section-list.component.scss']
})
export class CommentSectionListComponent extends BaseComponent implements OnInit {
    @ViewChild(`motionCommentDialog`, { static: true })
    private motionCommentDialog: TemplateRef<string>;

    private dialogRef: MatDialogRef<any>;

    public currentComment: ViewMotionCommentSection | null;

    /**
     * Source of the Data
     */
    public commentSections: ViewMotionCommentSection[] = [];

    /**
     * formgroup for editing and creating of comments
     */
    public commentFieldForm: FormGroup;

    public groups: Observable<ViewGroup[]>;

    public constructor(
        componentServiceCollector: ComponentServiceCollectorService,
        protected override translate: TranslateService,
        private repo: MotionCommentSectionControllerService,
        private formBuilder: FormBuilder,
        private promptService: PromptService,
        private dialog: MatDialog,
        private groupRepo: GroupControllerService
    ) {
        super(componentServiceCollector, translate);

        const form = {
            name: [``, Validators.required],
            read_group_ids: [[]],
            write_group_ids: [[]]
        };
        this.commentFieldForm = this.formBuilder.group(form);
    }

    /**
     * Init function.
     */
    public ngOnInit(): void {
        super.setTitle(`Comment fields`);

        this.groups = this.groupRepo.getViewModelListObservable();
        this.subscriptions.push(
            this.repo
                .getViewModelListObservable()
                .subscribe(newViewSections => (this.commentSections = newViewSections))
        );
    }

    /**
     * Event on Key Down in form.
     *
     * @param event the keyboard event
     */
    public onKeyDown(event: KeyboardEvent): void {
        if (event.key === `Enter` && event.shiftKey) {
            this.save();
            this.dialogRef.close();
        }
        if (event.key === `Escape`) {
            this.dialogRef.close();
        }
    }

    /**
     * Opens the create dialog.
     */
    public openDialog(commentSection?: ViewMotionCommentSection): void {
        this.currentComment = commentSection;
        this.commentFieldForm.reset({
            name: commentSection ? commentSection.name : ``,
            read_group_ids: commentSection ? commentSection.read_group_ids : [],
            write_group_ids: commentSection ? commentSection.write_group_ids : []
        });
        this.dialogRef = this.dialog.open(this.motionCommentDialog, infoDialogSettings);
        this.dialogRef.afterClosed().subscribe(res => {
            if (res) {
                this.save();
            }
        });
    }

    /**
     * saves the current data, either updating an existing comment or creating a new one.
     */
    private save(): void {
        if (!this.commentFieldForm.valid) {
            return;
        }
        // eiher update or create
        if (this.currentComment) {
            this.handleRequest(this.updateSection());
        } else {
            this.handleRequest(this.createNewSection());
        }
        this.commentFieldForm.reset();
    }

    /**
     * is executed, when the delete button is pressed
     * @param viewSection The section to delete
     */
    public async onDeleteButton(viewSection: ViewMotionCommentSection): Promise<void> {
        const title = _(`Are you sure you want to delete this comment field?`);
        const content = viewSection.name;
        if (await this.promptService.open(title, content)) {
            this.handleRequest(this.deleteSection(viewSection));
        }
    }

    private updateSection(): Promise<void> {
        return this.repo.update(this.commentFieldForm.value as Partial<MotionCommentSection>, this.currentComment);
    }

    private createNewSection(): Promise<Identifiable> {
        const comment = new MotionCommentSection(this.commentFieldForm.value);
        return this.repo.create(comment);
    }

    private deleteSection(viewSection: ViewMotionCommentSection): Promise<void> {
        return this.repo.delete(viewSection);
    }

    private handleRequest(request: Promise<any>): void {
        request.catch(this.raiseError);
    }
}
