// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { FC, useState } from 'react';

import {
    Box,
    Button,
    Divider,
    Typography,
    LinearProgress,
    ListItem,
    Stack,
    ListItemIcon,
    List,
    Card,
    IconButton,
    Tooltip,
    ButtonGroup,
    useTheme,
} from '@mui/material';

import embed from 'vega-embed';
//import { powerbi } from 'vega-themes';
import AnimateOnChange from 'react-animate-on-change'


import '../scss/VisualizationView.scss';
import { useDispatch, useSelector } from 'react-redux';
import { DataFormulatorState, dfActions } from '../app/dfSlice';
import { assembleChart, baseTableToExtTable, getTriggers } from '../app/utils';
import { Chart, DictTable, EncodingItem, Trigger } from "../components/ComponentType";

import DeleteIcon from '@mui/icons-material/Delete';
import AddchartIcon from '@mui/icons-material/Addchart';
import StarIcon from '@mui/icons-material/Star';
import SouthIcon from '@mui/icons-material/South';
import TableRowsIcon from '@mui/icons-material/TableRowsOutlined';
import PanoramaFishEyeIcon from '@mui/icons-material/PanoramaFishEye';
import InsightsIcon from '@mui/icons-material/Insights';

import _ from 'lodash';
import { getChartTemplate } from '../components/ChartTemplates';
import { findBaseFields } from './ViewUtils';

import 'prismjs/components/prism-python' // Language
import 'prismjs/components/prism-typescript' // Language
import 'prismjs/themes/prism.css'; //Example style, you can use another


import { chartAvailabilityCheck, generateChartSkeleton, getDataTable } from './VisualizationView';
import { TriggerCard } from './EncodingShelfCard';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

let buildChartCard = (chartElement: {tableId: string, chartId: string, element: any}, focusedChartId?: string) => {
    let selectedClassName = focusedChartId == chartElement.chartId ? 'selected-card' : '';
    return <Card className={`data-thread-card ${selectedClassName}`} variant="outlined" 
            sx={{
                    marginLeft: 1,
                    width: '100%',
                }}>
        {chartElement.element}
    </Card>
}

let SingleThreadView: FC<{
    threadIdx: number,
    leafTable: DictTable;
    chartElements: {tableId: string, chartId: string, element: any}[];
    usedTableIds: string[]
}> = function ({
        threadIdx,
        leafTable, 
        chartElements,
        usedTableIds, // tables that have been used
}) {
    let theme = useTheme();
    
    let tables = useSelector((state: DataFormulatorState) => state.tables);
    let charts = useSelector((state: DataFormulatorState) => state.charts);
    let focusedChartId = useSelector((state: DataFormulatorState) => state.focusedChartId);
    let focusedTableId = useSelector((state: DataFormulatorState) => state.focusedTableId);

    let focusedChart = charts.find(c => c.id == focusedChartId);
        
    const dispatch = useDispatch();

    let [collapsed, setCollapsed] = useState<boolean>(false);

    const w: any = (a: any[], b: any[], spaceElement?: any) => a.length ? [a[0], b.length == 0 ? "" : (spaceElement || ""), ...w(b, a.slice(1), spaceElement)] : b;

    let content : any = ""

    let tableIdList = [leafTable.id]
    let triggerCards: any[] = []
    let triggers = getTriggers(leafTable, tables);

    if (leafTable.derive) {
        let firstNewTableIndex =  triggers.findIndex(tg => !usedTableIds.includes(tg.tableId));
        firstNewTableIndex = firstNewTableIndex == -1 ? triggers.length : firstNewTableIndex;
        triggers = firstNewTableIndex > 0 ? triggers.slice(firstNewTableIndex - 1) : triggers;

        tableIdList = [...triggers.map((trigger) => trigger.tableId), leafTable.id];

        triggerCards = triggers.map((trigger, i) => {

            let selectedClassName = trigger.chartRef == focusedChartId ? 'selected-card' : '';

            let extractActiveFields = (t: Trigger) => {
                let encodingMap = (charts.find(c => c.id == t.chartRef) as Chart).encodingMap
                return Array.from(Object.values(encodingMap)).map((enc: EncodingItem) => enc.fieldID).filter(x => x != undefined);
            };

            let previousActiveFields = new Set(i == 0 ? [] : extractActiveFields(triggers[i - 1]))
            let currentActiveFields = new Set(extractActiveFields(trigger))
            let fieldsIdentical = _.isEqual(previousActiveFields, currentActiveFields)

            let triggerCard = <ListItem key={'thread-card-trigger-box'} sx={{padding: '0'}}>
                <Box sx={{flex: 1}} /*sx={{ width: 'calc(100% - 8px)', marginLeft: 1, borderLeft: '1px dashed darkgray' }}*/ >
                    <TriggerCard className={selectedClassName} trigger={trigger} hideFields={fieldsIdentical} />   
                </Box>
            </ListItem>;

            return <Box sx={{display: 'flex', flexDirection: 'column'}} key={`trigger-card-${trigger.chartRef}`}>
                {triggerCard}
                <ListItemIcon key={'down-arrow'} sx={{minWidth: 0}}>
                    <SouthIcon sx={{fontSize: "inherit"}} />
                </ListItemIcon>
            </Box>;
        });
    } 
    
    let tableList = tableIdList.map((tableId, i) => {
        // filter charts relavent to this
        let relevantCharts = chartElements.filter(ce => ce.tableId == tableId && !usedTableIds.includes(tableId));
        let table = tables.find(t => t.id == tableId);

        let selectedClassName = tableId == focusedTableId ? 'selected-card' : '';

        let collapsedProps = collapsed ? {width: '80px', height: '70px', "& canvas": {transformOrigin: 'top left', transform: 'scale(0.6)'} } : {}

        let releventChartElements = relevantCharts.map((ce, j) => 
                <Box key={`relevant-chart-${ce.chartId}`} 
                    sx={{display: 'flex', padding: '4px 0px', paddingBottom: j == relevantCharts.length - 1 ? 1 : 0.5,
                         ...collapsedProps  }}>
                    {buildChartCard(ce, focusedChartId)}
                </Box>)
        
        // only charts without dependency can be deleted
        let tableDeleteEnabled = table?.derive && !tables.some(t => t.derive?.trigger.tableId == tableId);
            
        let colloapsedTableBox = <ListItem sx={{padding: 0}}>
            <Box sx={{textTransform: 'none', padding: 0, minWidth: 0, color: 'gray'}} >
                <Stack direction="row" sx={{fontSize: '12px', fontWeight: tableId == focusedTableId ? 'bold' : 'normal'}} alignItems="center" gap={"2px"}>
                    <TableRowsIcon fontSize="inherit"  sx={{fontWeight: 'inherit'}}/>
                    <Typography sx={{fontSize: '12px', fontWeight: 'inherit'}} >
                        {tableId} 
                    </Typography>
                </Stack>
            </Box>
        </ListItem>;

        let regularTableBox = <ListItem sx={{padding: '0px'}}>
            <Card className={`data-thread-card ${selectedClassName}`} variant="outlined" 
                    sx={{ width: '100%', background: 'aliceblue' }} 
                    onClick={() => { 
                        dispatch(dfActions.setFocusedTable(tableId)); 
                        if (focusedChart?.tableRef != tableId) {
                            let firstRelatedChart = charts.find((c: Chart) => c.tableRef == tableId && c.intermediate == undefined) ||  charts.find((c: Chart) => c.tableRef == tableId);
                            if (firstRelatedChart) {
                                if (firstRelatedChart.intermediate == undefined) {
                                    dispatch(dfActions.setFocusedChart(firstRelatedChart.id));
                                }
                            } else {
                                dispatch(dfActions.createNewChart({tableId: tableId}));
                            }
                        }
                    }}>
                <Box sx={{margin: '0px', display: 'flex'}}>
                    <Stack direction="row" sx={{marginLeft: 1, marginRight: 'auto', fontSize: 12 }} alignItems="center" gap={"2px"}>
                        <TableRowsIcon  sx={{color: 'darkgray', width: '14px', height: '14px'}} />
                        <Box sx={{margin: '4px 8px 4px 2px'}}>
                            <Typography fontSize="inherit" sx={{textAlign: 'center', 
                                            color: 'rgba(0,0,0,0.7)',  maxWidth: 'calc(100%)'}}>{tableId}</Typography> 
                        </Box>
                    </Stack>
                    <ButtonGroup   aria-label="Basic button group" variant="text" sx={{textAlign:'end', margin: "auto 2px auto auto"}}>
                        {tableDeleteEnabled && <Tooltip title="delete table">
                            <IconButton aria-label="share" size="small" sx={{padding: '2px'}}>
                                <DeleteIcon fontSize="small" sx={{fontSize: 18}} color='warning'
                                    onClick={(event)=>{ 
                                        event.stopPropagation();
                                        dispatch(dfActions.deleteTable(tableId));
                                    }}/>
                            </IconButton>
                        </Tooltip>}
                        <Tooltip title="create a new chart">
                            <IconButton aria-label="share" size="small" sx={{padding: '2px'}}>
                                <AddchartIcon fontSize="small" sx={{fontSize: 18}} color='primary'
                                    onClick={(event)=>{ 
                                        event.stopPropagation();
                                        dispatch(dfActions.createNewChart({ tableId: tableId }));
                                    }}/>
                            </IconButton>
                        </Tooltip>
                    </ButtonGroup>
                </Box>
            </Card>
        </ListItem>

        let chartElementProps = collapsed ? {display: 'flex', flexWrap: 'wrap'} : {}

        return [
            regularTableBox,
            <Box sx={{display: 'flex', flexDirection: 'row'}}>
                <Button sx={{minWidth: '1px', padding: '0px', width: '17px',  flex: 'none', display: 'flex'
                            //borderLeft: '1px dashed darkgray',
                            }}>
                    <Box sx={{padding:0, width: '1px', margin:'auto', height: '100%',
                                //borderLeft: 'thin solid lightgray',
                                // the following for 
                                backgroundImage: 'linear-gradient(180deg, darkgray, darkgray 75%, transparent 75%, transparent 100%)',
                                backgroundSize: '1px 6px, 3px 100%'
                            }}></Box>
                </Button>
                <Box sx={{flex: 1, padding: '8px 0px', minHeight: '8px', ...chartElementProps}}>
                    {releventChartElements}
                </Box>
            </Box>,
                (i == tableIdList.length - 1) ? 
                <Box sx={{marginLeft: "6px", marginTop: '-10px'}}><PanoramaFishEyeIcon sx={{fontSize: 5}}/></Box>//<Divider  sx={{marginLeft: 1, width: "20px", borderColor: 'darkgray', borderStyle: 'dashed'}} orientation="horizontal" /> 
                : ""
        ]
    });

    content = w(tableList, triggerCards, "")

    return <>
        <Tooltip title={collapsed ? 'expand' : 'collapse'}>
            <Button fullWidth sx={{display: 'flex',  direction: 'ltr'}} color="primary" onClick={() => setCollapsed(!collapsed)}>
                <Divider flexItem sx={{
                            "& .MuiDivider-wrapper": {
                                display: 'flex', flexDirection: 'row',
                            },
                            "&::before, &::after": {
                                borderColor: theme.palette.primary.light,
                                opacity: 0.5,
                                borderWidth: '4px',
                                width: 50,

                            },
                        }} 
                        >
                    <Typography sx={{fontSize: "10px", fontWeight: 'bold', textTransform: 'none'}}>
                        {`thread - ${threadIdx + 1}`}
                    </Typography>
                    {!collapsed ? <ExpandLess sx={{fontSize: 14}}/> : <ExpandMore sx={{fontSize: 14}}/>}
                </Divider>
            </Button>
        </Tooltip>
        
        <List sx={{padding: '2px 4px 2px 4px', marginTop: 0, marginBottom: '8px', direction: 'ltr'}}>
            {content}
        </List>
    </>    
}

export const DataThread: FC<{}> = function ({ }) {

    let tables = useSelector((state: DataFormulatorState) => state.tables);
    let charts = useSelector((state: DataFormulatorState) => state.charts);
    let focusedChartId = useSelector((state: DataFormulatorState) => state.focusedChartId);
    let focusedTableId = useSelector((state: DataFormulatorState) => state.focusedTableId);

    let chartSynthesisInProgress = useSelector((state: DataFormulatorState) => state.chartSynthesisInProgress);
        
    const conceptShelfItems = useSelector((state: DataFormulatorState) => state.conceptShelfItems);

    const dispatch = useDispatch();

    // excluding base tables or tables from saved charts
    //let draftTables = tables.filter(t => t.derive && !charts.some(chart => chart. chart.tableRef == t.id));

    //console.log(tables);

    //let vegaSpec: any = createVegaObj(markType, encodingMap, conceptShelfItems)[0];
    // if (tables.length > 0) {
    //     vegaSpec = createVegaObj(markType, encodingMap, conceptShelfItems)[0];
    // }
    let derivedFields = conceptShelfItems.filter(f => f.source == "derived");

    // when there is no result and synthesis is running, just show the waiting panel

    // // we don't always render it, so make this a function to enable lazy rendering
    let chartElements = charts.filter(chart => !chart.intermediate).map((chart, index) => {
        const id = `data-thread-chart-Element-${chart.id}`;

        let table = getDataTable(chart, tables, charts, conceptShelfItems);

        let toDeriveFields = derivedFields.filter(f => f.name != "").filter(f => findBaseFields(f, conceptShelfItems).every(f2 => table.names.includes(f2.name)))
        let extTable = baseTableToExtTable(JSON.parse(JSON.stringify(table.rows)), toDeriveFields, conceptShelfItems);

        let chartTemplate = getChartTemplate(chart.chartType);

        let setIndexFunc = () => {
            //let focusedIndex = index;
            dispatch(dfActions.setFocusedChart(chart.id));
            dispatch(dfActions.setFocusedTable(table.id));
            //this.setState({focusedIndex, focusUpdated: true});
        }

        if (chart.chartType == "Auto") {
            let element =  <Box sx={{ position: "relative", width: "fit-content", display: "flex", flexDirection: "column", margin: 'auto', color: 'darkgray' }}>
                <InsightsIcon fontSize="medium"/>
            </Box>
            return {chartId: chart.id, tableId: table.id, element}
        }

        let [available, unfilledFields] = chartAvailabilityCheck(chart.encodingMap, conceptShelfItems, extTable);

        if (!available || chart.chartType == "Table") {
            //let elementBody = renderTableChart(chart, conceptShelfItems, extTable);

            let element = <Box key={`unavailable-${id}`} width={"100%"} 
                        className={"vega-thumbnail vega-thumbnail-box"} //+ (focusedChartId == chart.id ? " focused-vega-thumbnail" : "")} 
                        onClick={setIndexFunc} 
                        sx={{ display: "flex", backgroundColor: "rgba(0,0,0,0.01)", position: 'relative',
                            //border: "0.5px dashed lightgray", 
                            flexDirection: "column" }}>
                {chartSynthesisInProgress.includes(chart.id) ? <Box sx={{
                    position: "absolute", height: "100%", width: "100%", zIndex: 20, 
                    backgroundColor: "rgba(243, 243, 243, 0.8)", display: "flex", alignItems: "center", cursor: "pointer"
                }}>
                    <LinearProgress sx={{ width: "100%", height: "100%", opacity: 0.05 }} />
                </Box> : ''}
                <Box sx={{ display: "flex", flexDirection: "column", margin: "auto" }}>
                    <Box sx={{ margin: "auto" }} >
                        {generateChartSkeleton(chartTemplate?.icon, 48, 48)}
                    </Box>
                    <Box className='data-thread-chart-card-action-button' 
                         sx={{ zIndex: 10, color: 'blue', position: "absolute", right: 1, background: 'rgba(255, 255, 255, 0.95)' }}>
                        <Tooltip title="delete chart">
                            <IconButton size="small" color="warning" onClick={(event) => {
                                event.stopPropagation();
                                dispatch(dfActions.deleteChartById(chart.id));
                            }}><DeleteIcon fontSize="small" /></IconButton>
                        </Tooltip>
                    </Box>
                </Box>
                {/* <TriggerCard chartId={chart.id} noBorder={true} /> */}
            </Box>;
            return {chartId: chart.id, tableId: table.id, element}
        }

        // prepare the chart to be rendered
        //let vgSpec: any = instantiateVegaTemplate(chart.chartType, chart.encodingMap, conceptShelfItems, extTable)[0];
        let assembledChart = assembleChart(chart, conceptShelfItems, extTable);
        assembledChart["background"] = "transparent";
        // chart["autosize"] = {
        //     "type": "fit",
        //     "contains": "padding"
        // };

        const element =
            <Box
                key={`animateOnChange-carousel-${index}`}
                onClick={setIndexFunc}
                className="vega-thumbnail-box"
                // baseClassName="vega-thumbnail-box"
                // animationClassName="vega-thumbnail-box-animation"
                // animate={chartUpdated == chart.id}
                style={{ width: "100%", position: "relative", cursor: "pointer !important" }}
                //onAnimationEnd={() => { setChartUpdated(undefined); }}
            >
                <Box sx={{margin: "auto"}}>
                    {chart.saved ? <Typography sx={{ position: "absolute", margin: "5px", zIndex: 2 }}>
                                        <StarIcon sx={{ color: "gold" }} fontSize="small" />
                                    </Typography> : ""}
                    {chartSynthesisInProgress.includes(chart.id) ? <Box sx={{
                        position: "absolute", height: "100%", width: "100%", zIndex: 20, 
                        backgroundColor: "rgba(243, 243, 243, 0.8)", display: "flex", alignItems: "center", cursor: "pointer"
                    }}>
                        <LinearProgress sx={{ width: "100%", height: "100%", opacity: 0.05 }} />
                    </Box> : ''}
                    <Box className='data-thread-chart-card-action-button' 
                         sx={{ zIndex: 10, color: 'blue', position: "absolute", right: 1, background: 'rgba(255, 255, 255, 0.95)' }}>
                        <Tooltip title="delete chart">
                            <IconButton size="small" color="warning" onClick={(event) => {
                                event.stopPropagation();
                                dispatch(dfActions.deleteChartById(chart.id));
                            }}><DeleteIcon fontSize="small" /></IconButton>
                        </Tooltip>
                    </Box>
                    <Box className={"vega-thumbnail" + (focusedChartId == chart.id ? " focused-vega-thumbnail" : "")}
                        id={id} key={`chart-thumbnail-${index}`} sx={{ margin: "auto", backgroundColor: chart.saved ? "rgba(255,215,0,0.05)" : "white" }}
                    >
                    </Box>
                    
                </Box>
            </Box>;

        // Temporary fix, down sample the dataset
        if (assembledChart["data"]["values"].length > 5000) {
            let values = assembledChart["data"]["values"];
            assembledChart = (({ data, ...o }) => o)(assembledChart);

            let getRandom = (seed: number) => {
                var x = Math.sin(seed++) * 10000;
                return x - Math.floor(x);
            }
            let getRandomSubarray = (arr: any[], size: number) => {
                var shuffled = arr.slice(0), i = arr.length, temp, index;
                while (i--) {
                    index = Math.floor((i + 1) * getRandom(233 * i + 888));
                    temp = shuffled[index];
                    shuffled[index] = shuffled[i];
                    shuffled[i] = temp;
                }
                return shuffled.slice(0, size);
            }
            assembledChart["data"] = { "values": getRandomSubarray(values, 5000) };
        }

        assembledChart['config'] = {
            "axis": {"labelLimit": 30}
        }

        embed('#' + id, assembledChart, { actions: false, renderer: "canvas" }).then(function (result) {
            // Access the Vega view instance (https://vega.github.io/vega/docs/api/view/) as result.view
            if (result.view.container()?.getElementsByTagName("canvas")) {
                let comp = result.view.container()?.getElementsByTagName("canvas")[0];

                // Doesn't seem like width & height are actual numbers here on Edge bug
                // let width = parseInt(comp?.style.width as string);
                // let height = parseInt(comp?.style.height as string);
                if (comp) {
                    const { width, height } = comp.getBoundingClientRect();
                    //console.log(`THUMB: width = ${width} height = ${height}`);

                    let WIDTH = 120;
                    let HEIGHT = 80;

                    if (width > WIDTH || height > HEIGHT) {
                        let ratio = width / height;
                        let fixedWidth = width;
                        if (ratio * HEIGHT < width) {
                            fixedWidth = ratio * HEIGHT;
                        }
                        if (fixedWidth > WIDTH) {
                            fixedWidth = WIDTH;
                        }
                        //console.log("THUMB: width or height are oversized");
                        //console.log(`THUMB: new width = ${fixedWidth}px height = ${fixedWidth / ratio}px`)
                        comp?.setAttribute("style", 
                            `max-width: ${WIDTH}px; max-height: ${HEIGHT}px; 
                             width: ${Math.round(fixedWidth)}px; height: ${Math.round(fixedWidth / ratio)}px; `);
                    }

                } else {
                    console.log("THUMB: Could not get Canvas HTML5 element")
                }
            }
        }).catch((reason) => {
            // console.log(reason)
            // console.error(reason)
        });

        return {chartId: chart.id, tableId: table.id, element};
    })
 

    let refTables = tables; //[...new Set(chartElements.map(ce => tables.find(t => t.id == ce.tableId) as DictTable))];
    let leafTables = refTables.filter(t => !refTables.some(t2 => t2.derive?.trigger.tableId == t.id));

    let threadView =  <Box sx={{margin: "0px 0px 8px 0px"}}>
            {[
                ...leafTables.map((lt, i) => {
                    let usedTableIds = leafTables.slice(0, i).map(x => [x.id, ...getTriggers(x, tables).map(y => y.tableId) || []]).flat();
                    return <SingleThreadView threadIdx={i} leafTable={lt} chartElements={chartElements} usedTableIds={usedTableIds} />
                }),
            ]}
        </Box>

    let carousel = (
        <Box className="data-thread" >
            <Box sx={{ direction: 'ltr', display: 'flex', marginTop: "10px", alignItems: 'center', justifyContent: 'space-between'}}>
                <Typography className="view-title" component="h2" sx={{marginTop: "6px"}}>
                    Data Threads
                </Typography>
            </Box>
            <AnimateOnChange
                baseClassName="thread-view-mode"
                animationClassName="thread-view-animation">
                {threadView}
                <Box sx={{height: 100}}> </Box>
            </AnimateOnChange>
        </Box>
    );

    return <Box sx={{display: 'flex', flexDirection: 'row'}}>
        {carousel}
    </Box>;
}

