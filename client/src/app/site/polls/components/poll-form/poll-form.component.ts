import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';

import { Observable } from 'rxjs';

import { GroupRepositoryService } from 'app/core/repositories/users/group-repository.service';
import { ComponentServiceCollector } from 'app/core/ui-services/component-service-collector';
import { MeetingSettingsService } from 'app/core/ui-services/meeting-settings.service';
import { VotingPrivacyWarningComponent } from 'app/shared/components/voting-privacy-warning/voting-privacy-warning.component';
import { AssignmentPollMethod, AssignmentPollPercentBase } from 'app/shared/models/assignments/assignment-poll';
import { PercentBase } from 'app/shared/models/poll/base-poll';
import { PollType } from 'app/shared/models/poll/base-poll';
import { ParentErrorStateMatcher } from 'app/shared/parent-error-state-matcher';
import { infoDialogSettings } from 'app/shared/utils/dialog-settings';
import { isNumberRange } from 'app/shared/validators/custom-validators';
import { ViewAssignmentPoll } from 'app/site/assignments/models/view-assignment-poll';
import { BaseComponent } from 'app/site/base/components/base.component';
import {
    BaseViewPoll,
    MajorityMethodVerbose,
    PollClassType,
    PollPropertyVerbose,
    PollTypeVerbose
} from 'app/site/polls/models/base-view-poll';
import { ViewGroup } from 'app/site/users/models/view-group';
import { PollService } from '../../services/poll.service';

@Component({
    selector: 'os-poll-form',
    templateUrl: './poll-form.component.html',
    styleUrls: ['./poll-form.component.scss'],
    encapsulation: ViewEncapsulation.None
})
export class PollFormComponent<T extends BaseViewPoll, S extends PollService> extends BaseComponent implements OnInit {
    /**
     * The form-group for the meta-info.
     */
    public contentForm: FormGroup;
    public parentErrorStateMatcher = new ParentErrorStateMatcher();

    public PollType = PollType;
    public PollPropertyVerbose = PollPropertyVerbose;

    /**
     * The different methods for this poll.
     */
    @Input()
    public pollMethods: { [key: string]: string };

    /**
     * The different percent bases for this poll.
     */
    @Input()
    public percentBases: { [key: string]: string };

    @Input()
    public data: Partial<T>;

    @Input()
    private pollService: S;

    /**
     * The different types the poll can accept.
     */
    public pollTypes = PollTypeVerbose;

    /**
     * The majority methods for the poll.
     */
    public majorityMethods = MajorityMethodVerbose;

    /**
     * the filtered `percentBases`.
     */
    public validPercentBases: { [key: string]: string };

    /**
     * Reference to the observable of the groups. Used by the `search-value-component`.
     */
    public groupObservable: Observable<ViewGroup[]> = null;

    /**
     * An twodimensional array to handle constant values for this poll.
     */
    public pollValues: [string, unknown][] = [];

    /**
     * Model for the checkbox.
     * If true, the given poll will immediately be published.
     */
    public publishImmediately = true;

    public showNonNominalWarning = false;

    public get isEVotingEnabled(): boolean {
        if (this.pollService) {
            return this.pollService.isElectronicVotingEnabled;
        } else {
            return false;
        }
    }

    public get isEVotingSelected(): boolean {
        return this.contentForm.get('type').value && this.contentForm.get('type').value !== 'analog';
    }

    /**
     * Constructor. Retrieves necessary metadata from the pollService,
     * injects the poll itself
     */
    public constructor(
        componentServiceCollector: ComponentServiceCollector,
        private fb: FormBuilder,
        private groupRepo: GroupRepositoryService,
        private dialog: MatDialog,
        private meetingSettingsService: MeetingSettingsService
    ) {
        super(componentServiceCollector);
        this.initContentForm();
    }

    /**
     * OnInit.
     * Sets the observable for groups.
     */
    public ngOnInit(): void {
        // without default group since default cant ever vote
        this.groupObservable = this.groupRepo.getViewModelListObservableWithoutDefaultGroup();

        if (this.data) {
            if (this.data.state) {
                this.disablePollType();
            }

            if (this.data instanceof ViewAssignmentPoll) {
                if (this.data.assignment && !this.data.max_votes_amount) {
                    this.data.max_votes_amount = this.data.assignment.open_posts;
                }
                if (!this.data.pollmethod) {
                    this.data.pollmethod = this.meetingSettingsService.instant('assignment_poll_default_method');
                }
            }

            this.patchForm(this.contentForm);
        }
        this.updatePollValues(this.contentForm.value);
        this.updatePercentBases(this.contentForm.get('pollmethod').value);

        this.subscriptions.push(
            // changes to whole form
            this.contentForm.valueChanges.subscribe(values => {
                if (values) {
                    this.updatePollValues(values);
                }
            }),
            // poll method changes
            this.contentForm.get('pollmethod').valueChanges.subscribe(method => {
                if (method) {
                    this.updatePercentBases(method);
                    this.setWarning();
                }
            }),
            // poll type changes
            this.contentForm.get('type').valueChanges.subscribe(() => {
                this.setWarning();
            })
        );

        this.setWarning();
    }

    /**
     * Generic recursive helper function to patch the form
     * will transitive move poll.min_votes_amount and poll.max_votes_amount into
     * form.votes_amount.min_votes_amount/max_votes_amount
     * @param formGroup
     */
    private patchForm(formGroup: FormGroup): void {
        for (const key of Object.keys(formGroup.controls)) {
            const currentControl = formGroup.controls[key];
            if (currentControl instanceof FormControl) {
                if (this.data[key]) {
                    currentControl.patchValue(this.data[key]);
                }
            } else if (currentControl instanceof FormGroup) {
                this.patchForm(currentControl);
            }
        }
    }

    private disablePollType(): void {
        this.contentForm.get('type').disable();
    }

    public showAmountAndGlobal(data: any): boolean {
        const selectedPollMethod = this.contentForm.get('pollmethod').value;
        return (selectedPollMethod === 'Y' || selectedPollMethod === 'N') && (!data || !data.state || data.isCreated);
    }

    /**
     * updates the available percent bases according to the pollmethod
     * @param method the currently chosen pollmethod
     */
    private updatePercentBases(method: AssignmentPollMethod): void {
        if (method) {
            let forbiddenBases = [];
            if (method === AssignmentPollMethod.YN) {
                forbiddenBases = [PercentBase.YNA, AssignmentPollPercentBase.Y];
            } else if (method === AssignmentPollMethod.YNA) {
                forbiddenBases = [AssignmentPollPercentBase.Y];
            } else if (method === AssignmentPollMethod.Y || AssignmentPollMethod.N) {
                forbiddenBases = [PercentBase.YN, PercentBase.YNA];
            }

            const bases = {};
            for (const [key, value] of Object.entries(this.percentBases)) {
                if (!forbiddenBases.includes(key)) {
                    bases[key] = value;
                }
            }
            // update value in case that its no longer valid
            const percentBaseControl = this.contentForm.get('onehundred_percent_base');
            percentBaseControl.setValue(this.getNormedPercentBase(percentBaseControl.value, method));

            this.validPercentBases = bases;
        }
    }

    private getNormedPercentBase(
        base: AssignmentPollPercentBase,
        method: AssignmentPollMethod
    ): AssignmentPollPercentBase {
        if (
            method === AssignmentPollMethod.YN &&
            (base === AssignmentPollPercentBase.YNA || base === AssignmentPollPercentBase.Y)
        ) {
            return AssignmentPollPercentBase.YN;
        } else if (method === AssignmentPollMethod.YNA && base === AssignmentPollPercentBase.Y) {
            return AssignmentPollPercentBase.YNA;
        } else if (
            method === AssignmentPollMethod.Y &&
            (base === AssignmentPollPercentBase.YN || base === AssignmentPollPercentBase.YNA)
        ) {
            return AssignmentPollPercentBase.Y;
        }
        return base;
    }

    /**
     * Disable votes_amount form control if the poll type is anonymous
     * and the poll method is votes.
     */
    private setWarning(): void {
        if (this.contentForm.get('type').value === PollType.Pseudoanonymous) {
            this.showNonNominalWarning = true;
        } else {
            this.showNonNominalWarning = false;
        }
    }

    public getValues(): Partial<T> {
        return { ...this.data, ...this.serializeForm(this.contentForm) };
    }

    private serializeForm(formGroup: FormGroup): Partial<T> {
        const formData = { ...formGroup.value, ...formGroup.value.votes_amount };
        delete formData.votes_amount;
        return formData;
    }

    /**
     * This updates the poll-values to get correct data in the view.
     *
     * @param data Passing the properties of the poll.
     */
    private updatePollValues(data: { [key: string]: any }): void {
        if (this.data) {
            this.pollValues = [
                [
                    this.pollService.getVerboseNameForKey('type'),
                    this.pollService.getVerboseNameForValue('type', data.type)
                ]
            ];
            // show pollmethod only for assignment polls
            if (this.data.pollClassType === PollClassType.Assignment) {
                this.pollValues.push([
                    this.pollService.getVerboseNameForKey('pollmethod'),
                    this.pollService.getVerboseNameForValue('pollmethod', data.pollmethod)
                ]);
            }
            if (data.type !== 'analog') {
                this.pollValues.push([
                    this.pollService.getVerboseNameForKey('groups'),
                    data && data.groups_id && data.groups_id.length
                        ? this.groupRepo.getNameForIds(...data.groups_id)
                        : '---'
                ]);
            }

            if (data.pollmethod === 'Y' || data.pollmethod === 'N') {
                this.pollValues.push([this.pollService.getVerboseNameForKey('votes_amount'), data.votes_amount]);
                this.pollValues.push([this.pollService.getVerboseNameForKey('global_yes'), data.global_yes]);
                this.pollValues.push([
                    this.pollService.getVerboseNameForKey('max_votes_amount'),
                    data.max_votes_amount
                ]);
                this.pollValues.push([
                    this.pollService.getVerboseNameForKey('min_votes_amount'),
                    data.min_votes_amount
                ]);
                this.pollValues.push([this.pollService.getVerboseNameForKey('global_no'), data.global_no]);
                this.pollValues.push([this.pollService.getVerboseNameForKey('global_abstain'), data.global_abstain]);
            }
        }
    }

    private initContentForm(): void {
        this.contentForm = this.fb.group({
            title: ['', Validators.required],
            type: ['', Validators.required],
            pollmethod: ['', Validators.required],
            onehundred_percent_base: ['', Validators.required],
            majority_method: ['', Validators.required],
            votes_amount: this.fb.group(
                {
                    max_votes_amount: [1, [Validators.required, Validators.min(1)]],
                    min_votes_amount: [1, [Validators.required, Validators.min(1)]]
                },
                { validator: isNumberRange('min_votes_amount', 'max_votes_amount') }
            ),
            groups_id: [],
            global_yes: [false],
            global_no: [false],
            global_abstain: [false]
        });
    }

    public openVotingWarning(event: MouseEvent): void {
        event.stopPropagation();
        this.dialog.open(VotingPrivacyWarningComponent, infoDialogSettings);
    }

    /**
     * compare function used with the KeyValuePipe to display the percent bases in original order
     */
    public keepEntryOrder(): number {
        return 0;
    }
}
