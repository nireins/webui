import { Component, AfterViewInit, Input, ViewChild, OnDestroy} from '@angular/core';
import { CoreServiceInjector } from 'app/core/services/coreserviceinjector';
import { CoreService, CoreEvent } from 'app/core/services/core.service';
import { MaterialModule } from 'app/appMaterial.module';
import { NgForm } from '@angular/forms';
import { ChartData } from 'app/core/components/viewchart/viewchart.component';

import { Router } from '@angular/router';
import { UUID } from 'angular2-uuid';
import * as d3 from 'd3';
import * as c3 from 'c3';

import { AnimationDirective } from 'app/core/directives/animation.directive';
import filesize from 'filesize';
import { WidgetChartComponent, TimeData } from 'app/core/components/widgets/widgetchart/widgetchart.component';
import { TranslateService } from '@ngx-translate/core';

import { T } from '../../../../translate-marker';

@Component({
  selector: 'widget-memory-history',
  templateUrl:'./widgetmemoryhistory.component.html',
  styleUrls: ['./widgetmemoryhistory.component.css']
})
export class WidgetMemoryHistoryComponent extends WidgetChartComponent implements AfterViewInit, OnDestroy {

  public totalMemory:number;
  public title:string = T("Memory Usage");
  protected _subtitle:string;
  get subtitle(){
    let value = T("of " + this.totalMemory + "GB total");
    return value;
  }
  set subtitle(val){
    this._subtitle = val;
  }

  public widgetColorCssVar = "var(--yellow)";
  private chartData:CoreEvent;

  constructor(public router: Router, public translate: TranslateService){
    super(router, translate);
  }

  ngOnDestroy(){
    this.core.emit({name:"StatsRemoveListener", data:{name:"Memory", obj:this}});
  }

  ngAfterViewInit(){
    this.core.emit({name:"SysInfoRequest"});
    this.core.emit({name:"StatsAddListener", data:{name:"Memory",key:"memory", obj:this} });

    this.core.register({observerClass:this,eventName:"StatsMemory"}).subscribe((evt:CoreEvent) => {
      console.log(evt);
      // if we don't know installed memory, store the chartData.
      if(this.totalMemory){
        this.setChartData(evt);
      } else {
        this.chartData = evt;
      }
    });

    this.core.register({observerClass:this,eventName:"SysInfo"}).subscribe((evt:CoreEvent) => {
      this.totalMemory = this.formatMemory(evt.data.physmem, "GB");
      this.chartSetup();
      if(this.chartData){
        this.setChartData(this.chartData);
      } else {
        
      }
    });

  }

  chartSetup(){
    // Generate Regions
    /*let generatedRegions = [];
     for(let i = 0; i < 100; i++){
       let vent = i % 20;
       if(vent == 0){
         generatedRegions.push({axis: 'y', start: i+10, end: i + 20, class: 'regionEven'})
       }
     }*/

     this.chart = c3.generate({
       bindto: '#' + this.chartId,
       size: {
         height:176
       },
       data: {
         x: "x",
         columns: [
           ['x'],
           ['total']
         ],
         type: 'spline',
         colors: {
           total:this.widgetColorCssVar//"var(--yellow)"// Cant use this.widgetColorCssVar
         },
         onmouseout: (d) => {
           this.showLegendValues = false;
         }
       },
       axis: {
         x: {
           show:false,
           type: 'timeseries',
           tick: {
             count: 2,
             fit:true,
             format: '%HH:%M:%S'
           }
         },
         y: {
           show:true,
           inner:true,
           max: this.totalMemory,
           tick: {
             count:3,
             values: [
               (this.totalMemory * 0.25), 
               (this.totalMemory * 0.5), 
               (this.totalMemory * 0.75), 
               this.totalMemory
             ],
             format: (y) => { return y + "GB" }
           }
         }
       },
       legend: {
         show: false
       },
       grid: {
         x: {
           show: true
         },
         y: {
           show: true
         }
       },
       tooltip: {
         //show: false,
         contents: (raw, defaultTitleFormat, defaultValueFormat, color) => {
           if(!this.showLegendValues){
             this.showLegendValues = true;
           }
           this.altTitle = "Memory Used " + raw[0].value + "GB";
           this.altSubtitle = raw[0].x;

           return '<div style="display:none">' + raw[0].x + '</div>';
         }
       }
     });
  }

  setChartData(evt:CoreEvent){
    console.log("SET MEMORY DATA");
    console.log(evt.data);

    let parsedData = [];
    let dataTypes = [];
    dataTypes = evt.data.meta.legend;

    // populate parsedData 
    for(let index in dataTypes){
      let chartData:ChartData = {
        legend: dataTypes[index],
        data:[]
      }
      for(let i in evt.data.data){
        let bytes = evt.data.data[i][index];
        let gigs = bytes/1024/1024/1024 //OLD bytes/1073741824;
        chartData.data.push(Number(gigs.toFixed(2)))
      }
      parsedData.push(chartData);
    }


    //console.log(parsedData);
    let xColumn = this.makeTimeAxis(evt.data.meta, parsedData);
    //parsedData[4].data.unshift("active");
    let finalStat = this.aggregateData(["laundry","wired","active","cache"], parsedData);

    this.startTime = this.timeFromDate(xColumn[1]);

    this.endTime = this.timeFromDate(xColumn[xColumn.length - 1]);

    //console.log(xColumn);
    //console.log(parsedData[4].data);
    
    let cols = this.makeColumns([finalStat]);
    cols.unshift(xColumn);
    //console.log(cols);
    this.chart.load({
      columns:cols
    })
    /*this.chart.load({
      columns: [
        xColumn,
        //parsedData[4].data
        finalStats
      ]
    });*/
  }

  protected makeTimeAxis(td:TimeData, data:any,  axis?: string):any[]{
    if(!axis){ axis = 'x';}
      let labels: any[] = [axis];
    //console.log(td);
    data[0].data.forEach((item, index) =>{
      let date = new Date(td.start * 1000 + index * td.step * 1000);
      labels.push(date);
    });

    return labels;
  }

  timeFromDate(date:Date){
    let hh = date.getHours().toString();
    let mm = date.getMinutes().toString();
    let ss = date.getSeconds().toString();

    if(hh.length < 2){
      hh = "0" + hh
    }
    if(mm.length < 2){
      mm = "0" + mm
    }
    if(ss.length < 2){
      ss = "0" + ss
    }
    return hh + ":" + mm + ":" + ss;
  }

  setPreferences(form:NgForm){
    let filtered: string[] = [];
    for(let i in form.value){
      if(form.value[i]){
        filtered.push(i);
      }
    }
  }

  formatMemory(physmem:number, units:string){
    let result:string; 
    if(units == "MB"){
      result = Number(physmem / 1024 / 1024).toFixed(0)// + ' MB';
    } else if(units == "GB"){
      result = Number(physmem / 1024 / 1024 / 1024).toFixed(0)// + ' GB';
    }
    return Number(result)
  }

}

