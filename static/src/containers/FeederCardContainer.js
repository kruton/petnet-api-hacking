import React from "react";
import PropTypes from "prop-types";
import {withRouter} from 'react-router-dom';
import {connect} from "react-redux";
import {FeederCardComponent} from "../components/FeederCard";
import {getFeederDevices} from "../actions/getFeederDevices";
import {getFeederTelemetryAction} from "../actions/getFeederTelemetry";
import {feederDeviceShape, feederTelemetryShape} from "../shapes/feeder";
import {formatUnixTimestamp, isStale} from "../util";
import {showFeederWizard} from "../actions/newFeederWizard";
import {NewFeederCardComponent} from "../components/NewFeederCard";
import {getRecipeAction} from "../actions/getRecipe";
import {showSnackModal} from "../actions/snackModal";
import {showEditFeederModal} from "../actions/editFeederModal";

class FeederCardContainer extends React.Component {
    state = {
        feeder: {},
        telemetry: {},
        snackModal: false,
        snackModalPortion: 0.0625,
        editModal: false,
        modFeederName: "",
        showConfirmDelete: false,
        manualFeedPortion: 0
    }


    constructor(props) {
        super(props);
        this.refreshFeederTelemetry = this.refreshFeederTelemetry.bind(this)
        this.state.feeder = props.feeder
    }

    componentDidMount() {
        this.refreshFeederTelemetry()
        this.setState({
            modFeederName: this.props.feeder.name
        })
        this.props.dispatchGetRecipe(this.state.feeder.hid).then(() => {
            const rcpState = this.props.getRecipeState
            if (!rcpState._requestFailed && this.state.feeder.hid in rcpState.recipes) {
                const inTbsp = rcpState.recipes[this.state.feeder.hid]["tbsp_per_feeding"] / 16
                this.setState({manualFeedPortion: inTbsp})
            }
        })
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (
            this.props.feeder.lastPingedAt !== prevProps.feeder.lastPingedAt ||
            this.props.feeder.name !== prevProps.feeder.name ||
            this.props.feeder.timezone !== prevProps.feeder.timezone ||
            this.props.feeder.frontButton !== prevProps.feeder.frontButton
        ) {
            this.setState({feeder: this.props.feeder})
        }
    }

    refreshFeederTelemetry() {
        this.props.dispatchGetFeederTelemetry(this.props.feeder.hid).then(() => {
            if (!this.props.getFeederTelemetryState._requestFailed) {
                this.setState({
                    telemetry: this.props.getFeederTelemetryState.data
                })
            }
        })
    }

    render() {
        // Check last seen date or show registration date.
        const lastPing = this.state.feeder.lastPingedAt ? this.state.feeder.lastPingedAt : this.state.feeder.discoveredAt
        const lastPingDate = formatUnixTimestamp(lastPing)
        // Has the feeder sent a heartbeat in the last two minutes or is it actively connected to the broker?
        const connected = this.state.feeder.connected || !isStale(lastPing)
        // This is to cover the case where we need to disable the buttons and telemetry
        // for devices that have registered themselves but not yet connected to MQTT
        const justDiscovered = connected && (this.state.feeder.lastPingedAt === 0 || this.state.feeder.lastPingedAt === null)

        return <>
            {
                this.props.feeder.currentRecipe === null ?
                    <NewFeederCardComponent
                        key={this.props.feeder.hid}
                        feeder={this.state.feeder}
                        showNewFeederWizard={() => this.props.dispatchShowNewFeederWizard(this.props.feeder.hid)}
                    /> :
                    <FeederCardComponent
                        key={this.props.feeder.hid}
                        feeder={this.state.feeder}
                        telemetry={this.state.telemetry}
                        isStale={!connected}
                        isJustDiscovered={justDiscovered}
                        lastPing={lastPingDate}
                        showSnackModal={() => this.props.dispatchShowSnackModal(
                            this.props.feeder.hid, this.state.manualFeedPortion
                        )}
                        showEditModal={() => this.props.dispatchShowEditFeederModal(
                            this.props.feeder, this.state.manualFeedPortion
                        )}
                    />
            }
        </>
    }
}

FeederCardContainer.propTypes = {
    feeder: feederDeviceShape,
    getFeederTelemetryState: feederTelemetryShape,
    dispatchGetFeederTelemetry: PropTypes.func,
    dispatchShowSnackModal: PropTypes.func,
    dispatchShowEditFeederModal: PropTypes.func,
    getRecipeState: PropTypes.object
};

const FeederCard = withRouter(connect(
    (state) => {
        const {
            getFeederDevicesState,
            getFeederTelemetryState,
            getRecipeState
        } = state;
        return {
            getFeederDevicesState,
            getFeederTelemetryState,
            getRecipeState
        };
    }, (dispatch) => {
        return {
            dispatchGetFeeders() {
                return dispatch(getFeederDevices());
            },
            dispatchGetFeederTelemetry(deviceId) {
                return dispatch(getFeederTelemetryAction(deviceId))
            },
            dispatchShowNewFeederWizard(deviceId) {
                return dispatch(showFeederWizard(deviceId))
            },
            dispatchGetRecipe(deviceId) {
                return dispatch(getRecipeAction(deviceId))
            },
            dispatchShowSnackModal(deviceId, defaultPortion) {
                return dispatch(showSnackModal(deviceId, defaultPortion))
            },
            dispatchShowEditFeederModal(feeder, defaultPortion) {
                return dispatch(showEditFeederModal(feeder, defaultPortion))
            }
        };
    }
)(FeederCardContainer));

export default FeederCard;