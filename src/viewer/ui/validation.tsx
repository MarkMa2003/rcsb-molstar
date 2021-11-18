/**
 * Copyright (c) 2021 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Sebastian Bittrich <sebastian.bittrich@rcsb.org>
 */

import { CollapsableControls, CollapsableState } from 'molstar/lib/mol-plugin-ui/base';
import { TuneSvg } from 'molstar/lib/mol-plugin-ui/controls/icons';
import { StructureHierarchyManager } from 'molstar/lib/mol-plugin-state/manager/structure/hierarchy';
import { ValidationReport } from 'molstar/lib/extensions/rcsb/validation-report/prop';
import { ValidationReportGeometryQualityPreset } from 'molstar/lib/extensions/rcsb/validation-report/behavior';
import { ActionMenu } from 'molstar/lib/mol-plugin-ui/controls/action-menu';
import { Model } from 'molstar/lib/mol-model/structure/model';
import { MmcifFormat } from 'molstar/lib/mol-model-formats/structure/mmcif';

interface ValidationReportState extends CollapsableState {
    errorStates: Set<string>
}

const ValidationReportTag = 'validation-report';

/**
 * A high-level component that gives access to the validation report preset.
 */
export class ValidationReportControls extends CollapsableControls<{}, ValidationReportState> {
    protected defaultState() {
        return {
            header: 'Quality Assessment',
            isCollapsed: false,
            isHidden: true,
            errorStates: new Set<string>(),
            brand: { accent: 'gray' as const, svg: TuneSvg } // TODO better logo
        };
    }

    componentDidMount() {
        this.subscribe(this.plugin.managers.structure.hierarchy.behaviors.selection, () => {
            this.setState({
                isHidden: !this.canEnable(),
                errorStates: new Set<string>(),
                description: StructureHierarchyManager.getSelectedStructuresDescription(this.plugin)
            });
        });
    }

    get pivot() {
        return this.plugin.managers.structure.hierarchy.selection.structures[0];
    }

    canEnable() {
        const { selection } = this.plugin.managers.structure.hierarchy;
        if (selection.structures.length !== 1) return false;
        const pivot = this.pivot.cell;
        if (!pivot.obj) return false;
        return pivot.obj.data.models.length === 1 && ValidationReport.isApplicable(pivot.obj.data.models[0]);
    }

    get noValidationReport() {
        const structure = this.pivot.cell.obj?.data;
        if (!structure || structure.models.length !== 1) return true;
        const model = structure.models[0];
        return !model || !this.isFromPdbArchive(model);
    }

    isFromPdbArchive(model: Model) {
        if (!MmcifFormat.is(model.sourceData)) return false;
        return model.entryId.match(/^[1-9][a-z0-9]{3}$/i) !== null ||
            model.entryId.match(/^pdb_[0-9]{4}[1-9][a-z0-9]{3}$/i) !== null;
    }

    requestValidationReportPreset = async () => {
        try {
            await ValidationReportGeometryQualityPreset.apply(this.pivot.cell, Object.create(null), this.plugin);
        } catch (err) {
            this.setState(({ errorStates }) => {
                const errors = new Set(errorStates);
                errors.add(ValidationReportTag);
                return { errorStates: errors };
            });
        }
    }

    get actions(): ActionMenu.Items {
        // TODO this could support other kinds of reports/validation like the AlphaFold confidence scores
        const noValidationReport = this.noValidationReport;
        const validationReportError = this.state.errorStates.has(ValidationReportTag);
        return [
            {
                kind: 'item',
                label: validationReportError ? 'Failed to Obtain Validation Report' : (noValidationReport ? 'No Validation Report Available' : 'RCSB PDB Validation Report'),
                value: this.requestValidationReportPreset,
                disabled: noValidationReport || validationReportError
            },
        ];
    }

    selectAction: ActionMenu.OnSelect = item => {
        if (!item) return;
        (item?.value as any)();
    }

    renderControls() {
        return <ActionMenu items={this.actions} onSelect={this.selectAction} />;
    }
}