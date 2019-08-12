/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import * as React from 'react';
import { PluginUIComponent } from 'molstar/lib/mol-plugin/ui/base';
import { PluginContextContainer } from 'molstar/lib/mol-plugin/ui/plugin';
import { TransformUpdaterControl } from 'molstar/lib/mol-plugin/ui/state/update-transform';
import { StructureToolsWrapper } from 'molstar/lib/mol-plugin/ui/controls';
import { StateElements } from '../helpers';
import { ParameterControls } from 'molstar/lib/mol-plugin/ui/controls/parameters';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { PluginCommands } from 'molstar/lib/mol-plugin/command';
import { Canvas3DParams } from 'molstar/lib/mol-canvas3d/canvas3d';
import { StateObject, StateBuilder } from 'molstar/lib/mol-state';
import { PluginStateObject as PSO } from 'molstar/lib/mol-plugin/state/objects';
import { StateTransforms } from 'molstar/lib/mol-plugin/state/transforms';
import { StructureSelectionQueries as Q } from 'molstar/lib/mol-plugin/util/structure-selection-helper';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';

export class ControlsWrapper extends PluginUIComponent {
    componentDidMount() {
        this.subscribe(this.plugin.state.behavior.currentObject, () => this.forceUpdate());
        this.subscribe(this.plugin.events.state.object.updated, () => this.forceUpdate());
    }

    render() {
        return <div className='msp-scrollable-container msp-right-controls'>
            <PluginContextContainer plugin={this.plugin}>
                <GeneralSettings />
                <StructureControls
                    trajectoryRef={StateElements.Trajectory}
                    modelRef={StateElements.Model}
                    assemblyRef={StateElements.Assembly}
                />
                <TransformUpdaterControl nodeRef={StateElements.VolumeStreaming} header={{ name: 'Volume Controls', description: '' }} />
                <StructureToolsWrapper />
            </PluginContextContainer>
        </div>;
    }
}

//

const GeneralSettingsParams = {
    spin: Canvas3DParams.trackball.params.spin,
    backgroundColor: Canvas3DParams.renderer.params.backgroundColor,
    renderStyle: PD.Select('glossy', [['toon', 'Toon'], ['matte', 'Matte'], ['glossy', 'Glossy'], ['metallic', 'Metallic']]),
    occlusion: PD.Boolean(false),
}

type GeneralSettingsState = { isCollapsed?: boolean }

class GeneralSettings<P, S extends GeneralSettingsState> extends PluginUIComponent<P, S> {
    setSettings = (p: { param: PD.Base<any>, name: string, value: any }) => {
        if (p.name === 'spin') {
            const trackball = this.plugin.canvas3d.props.trackball;
            PluginCommands.Canvas3D.SetSettings.dispatch(this.plugin, { settings: { trackball: { ...trackball, spin: p.value } } });
        } else if (p.name === 'backgroundColor') {
            const renderer = this.plugin.canvas3d.props.renderer;
            PluginCommands.Canvas3D.SetSettings.dispatch(this.plugin, { settings: { renderer: { ...renderer, backgroundColor: p.value } } });
        } else if (p.name === 'renderStyle') {
            const postprocessing = this.plugin.canvas3d.props.postprocessing;
            const renderer = this.plugin.canvas3d.props.renderer;
            if (p.value === 'toon') {
                PluginCommands.Canvas3D.SetSettings.dispatch(this.plugin, { settings: {
                    postprocessing: { ...postprocessing, outlineEnable: true, },
                    renderer: { ...renderer, lightIntensity: 0, ambientIntensity: 1, roughness: 0.4, metalness: 0 }
                } });
            } else if (p.value === 'matte') {
                PluginCommands.Canvas3D.SetSettings.dispatch(this.plugin, { settings: {
                    postprocessing: { ...postprocessing, outlineEnable: false, },
                    renderer: { ...renderer, lightIntensity: 0.6, ambientIntensity: 0.4, roughness: 1, metalness: 0 }
                } });
            } else if (p.value === 'glossy') {
                PluginCommands.Canvas3D.SetSettings.dispatch(this.plugin, { settings: {
                    postprocessing: { ...postprocessing, outlineEnable: false, },
                    renderer: { ...renderer, lightIntensity: 0.6, ambientIntensity: 0.4, roughness: 0.4, metalness: 0 }
                } });
            } else if (p.value === 'metallic') {
                PluginCommands.Canvas3D.SetSettings.dispatch(this.plugin, { settings: {
                    postprocessing: { ...postprocessing, outlineEnable: false, },
                    renderer: { ...renderer, lightIntensity: 0.6, ambientIntensity: 0.4, roughness: 0.6, metalness: 0.4 }
                } });
            }
        } else if (p.name === 'occlusion') {
            const postprocessing = this.plugin.canvas3d.props.postprocessing;
            PluginCommands.Canvas3D.SetSettings.dispatch(this.plugin, { settings: {
                postprocessing: { ...postprocessing, occlusionEnable: p.value },
            } });
        }
    }

    get values () {
        let renderStyle = 'custom'
        const postprocessing = this.plugin.canvas3d.props.postprocessing;
        const renderer = this.plugin.canvas3d.props.renderer;
        if (postprocessing.outlineEnable) {
            if (renderer.lightIntensity === 0 && renderer.ambientIntensity === 1 && renderer.roughness === 0.4 && renderer.metalness === 0) {
                renderStyle = 'toon'
            }
        } else if (renderer.lightIntensity === 0.6 && renderer.ambientIntensity === 0.4) {
            if (renderer.roughness === 1 && renderer.metalness === 0) {
                renderStyle = 'matte'
            } else if (renderer.roughness === 0.4 && renderer.metalness === 0) {
                renderStyle = 'glossy'
            } else if (renderer.roughness === 0.6 && renderer.metalness === 0.4) {
                renderStyle = 'metallic'
            }
        }

        return {
            spin: this.plugin.canvas3d.props.trackball.spin,
            backgroundColor: this.plugin.canvas3d.props.renderer.backgroundColor,
            renderStyle,
            occlusion: this.plugin.canvas3d.props.postprocessing.occlusionEnable
        }
    }

    componentDidMount() {
        this.subscribe(this.plugin.events.canvas3d.settingsUpdated, () => this.forceUpdate());
    }

    toggleExpanded = () => {
        this.setState({ isCollapsed: !this.state.isCollapsed });
    }

    state = {
        isCollapsed: false
    } as Readonly<S>

    render() {
        const wrapClass = this.state.isCollapsed
            ? 'msp-transform-wrapper msp-transform-wrapper-collapsed'
            : 'msp-transform-wrapper';

        return this.plugin.canvas3d ? <div className={wrapClass}>
            <div className='msp-transform-header'>
                <button className='msp-btn msp-btn-block' onClick={this.toggleExpanded}>
                    General Settings
                </button>
            </div>
            {!this.state.isCollapsed &&
                <ParameterControls params={GeneralSettingsParams} values={this.values} onChange={this.setSettings} />
            }
        </div> : null;
    }
}

//

type StructureControlsState = {
    representation: string
    isCollapsed?: boolean
}
type StructureControlsProps = {
    trajectoryRef: string
    modelRef: string
    assemblyRef: string
}

class StructureControls<P extends StructureControlsProps, S extends StructureControlsState> extends PluginUIComponent<P, S> {
    private applyState(tree: StateBuilder) {
        return PluginCommands.State.Update.dispatch(this.plugin, { state: this.plugin.state.dataState, tree });
    }

    onChange = async (p: { param: PD.Base<any>, name: string, value: any }) => {
        // console.log('onChange', p.name, p.value)
        const { themeCtx } = this.plugin.structureRepresentation
        const state = this.plugin.state.dataState;
        const tree = state.build();
        if (p.name === 'assembly') {
            tree.to(StateElements.Assembly).update(
                StateTransforms.Model.StructureAssemblyFromModel,
                props => ({ ...props, id: p.value })
            );
            await this.applyState(tree);

            const { structureRepresentation: rep } = this.plugin.helpers
            await rep.setFromExpression('add', 'cartoon', Q.all)
            await rep.setFromExpression('add', 'carbohydrate', Q.all)
            await rep.setFromExpression('add', 'ball-and-stick', MS.struct.modifier.union([
                MS.struct.combinator.merge([ Q.ligandsPlusConnected, Q.branchedConnectedOnly, Q.water ])
            ]))
        } else if (p.name === 'model') {
            tree.to(StateElements.Model).update(
                StateTransforms.Model.ModelFromTrajectory,
                props => ({ ...props, modelIndex: p.value })
            );
            await this.applyState(tree);
        } else if (p.name === 'colorThemes') {
            const assembly = this.getAssembly()
            const dataCtx = { structure: assembly && assembly.data }

            Object.keys(p.value).forEach(k => {
                const repr = this.getRepresentation(k)
                if (repr && repr.params) {
                    const values = PD.getDefaultValues(themeCtx.colorThemeRegistry.get(name).getParams(dataCtx))
                    tree.to(repr.transform.ref).update(
                        StateTransforms.Representation.StructureRepresentation3D,
                        props => ({ ...props, colorTheme: { name: p.value[k], params: values }})
                    )
                }
            })
            await this.applyState(tree)
        }
    }

    getRepresentation(type: string) {
        return this.plugin.helpers.structureRepresentation.getRepresentation(StateElements.Assembly, type)
    }

    getParams = () => {
        const { themeCtx, registry } = this.plugin.structureRepresentation
        const trajectory = this.getTrajectory()
        const model = this.getModel()
        const assembly = this.getAssembly()

        const modelOptions: [number, string][] = []
        if (trajectory) {
            for (let i = 0, il = trajectory.data.length; i < il; ++i) {
                modelOptions.push([i, `${i + 1}`])
            }
        }

        const assemblyOptions: [string, string][] = [['deposited', 'deposited']]
        let modelValue = 0
        if (model) {
            if (trajectory) modelValue = trajectory.data.indexOf(model.data)
            const { assemblies } = model.data.symmetry
            for (let i = 0, il = assemblies.length; i < il; ++i) {
                const a = assemblies[i]
                assemblyOptions.push([a.id, `${a.id}: ${a.details}`])
            }
        }

        let assemblyValue = 'deposited'
        let colorTypes = themeCtx.colorThemeRegistry.types
        let types = registry.types
        if (assembly) {
            assemblyValue = assembly.data.units[0].conformation.operator.assembly.id
            colorTypes = themeCtx.colorThemeRegistry.getApplicableTypes({ structure: assembly.data })
            types = registry.getApplicableTypes(assembly.data)
        }

        const colorThemes: { [k: string]: PD.Any } = {}
        for (let i = 0, il = types.length; i < il; ++i) {
            const name = types[i][0]
            if (this.getRepresentation(name)) {
                colorThemes[name] = PD.Select(registry.get(name).defaultColorTheme, colorTypes)
            }
        }

        return {
            assembly: PD.Select(assemblyValue, assemblyOptions),
            model: PD.Select(modelValue, modelOptions),
            symmetry: PD.Select('todo', [['todo', 'todo']]),
            colorThemes: PD.Group(colorThemes, { isExpanded: true })
        }
    }

    get values () {
        const trajectory = this.getTrajectory()
        const model = this.getModel()
        const assembly = this.getAssembly()

        const { registry } = this.plugin.structureRepresentation
        const types = assembly ? registry.getApplicableTypes(assembly.data) : registry.types

        const colorThemes: { [k: string]: string } = {}
        for (let i = 0, il = types.length; i < il; ++i) {
            const type = types[i][0]
            const r = this.getRepresentation(type)
            colorThemes[type] = r && r.params ? r.params.values.colorTheme.name : registry.get(type).defaultColorTheme
        }

        return {
            assembly: assembly ? (assembly.data.units[0].conformation.operator.assembly.id || 'deposited') : 'deposited',
            model: (model && trajectory) ? trajectory.data.indexOf(model.data) : 0,
            symmetry: 'todo',
            colorThemes
        }
    }

    componentDidMount() {
        // const { dataState } = this.plugin.state
        // const { trajectoryRef, modelRef, assemblyRef } = this.props
        this.subscribe(this.plugin.events.state.object.updated, ({ ref, state }) => {
            // TODO check if in subtree of trajectoryRef
            // if ((trajectoryRef !== ref && modelRef !== ref && assemblyRef !== ref) || dataState !== state) return;
            this.forceUpdate();
        });

        this.subscribe(this.plugin.events.state.object.created, ({ ref, state }) => {
            // TODO check if in subtree of trajectoryRef
            // if ((trajectoryRef !== ref && modelRef !== ref && assemblyRef !== ref) || dataState !== state) return;
            this.forceUpdate();
        });
    }

    toggleExpanded = () => {
        this.setState({ isCollapsed: !this.state.isCollapsed });
    }

    state = {
        representation: this.plugin.structureRepresentation.registry.types[0][0],
        isCollapsed: false
    } as Readonly<S>

    private getObj<T extends StateObject>(ref: string): T | undefined {
        const state = this.plugin.state.dataState;
        const cell = state.select(ref)[0];
        if (!cell || !cell.obj) return void 0;
        return (cell.obj as T);
    }

    private getTrajectory() { return this.getObj<PSO.Molecule.Trajectory>(this.props.trajectoryRef) }
    private getModel() { return this.getObj<PSO.Molecule.Model>(this.props.modelRef) }
    private getAssembly() { return this.getObj<PSO.Molecule.Structure>(this.props.assemblyRef) }

    render() {
        const trajectory = this.getTrajectory()
        const model = this.getModel()
        const assembly = this.getAssembly()

        if (!trajectory || !model || !assembly) return null;

        const wrapClass = this.state.isCollapsed
            ? 'msp-transform-wrapper msp-transform-wrapper-collapsed'
            : 'msp-transform-wrapper';

        return this.plugin.canvas3d ? <div className={wrapClass}>
            <div className='msp-transform-header'>
                <button className='msp-btn msp-btn-block' onClick={this.toggleExpanded}>
                    Structure Settings
                </button>
            </div>
            {!this.state.isCollapsed &&
                <ParameterControls params={this.getParams()} values={this.values} onChange={this.onChange} />
            }
        </div> : null;
    }
}