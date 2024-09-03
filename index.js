(function() {
    
    const eventHandlers = [];
    let unmounting = false;
    
    let modal;
    
    let allData = [];
    let countries = null;
    let countriesRemoved = new Set();
    let eventTypesRemoved = new Set();
    
    let worldMap = null;
    let wordCloud = null;
    let barChart = null;
    let pieChart;

    const options = {
        method: 'GET',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        }
    };
    
    function checkElement(elementId, resolve) {
        const element = document.getElementById(elementId);
        
        if (element) {
        
            resolve($(element));
        }
        else if (!unmounting) {
            
            setTimeout(() => checkElement(elementId, resolve), 100);
        }
    }
    
    function waitForTopLevelElement() {
        
        return new Promise(resolve => checkElement("Data_Explorer", resolve));
    }
    
    function addEventHandler(element, event, handler) {
        $(element).on(event, handler);
        eventHandlers.push({ element, event, handler });
    }
    
    function configureCleanup() {
        const observer = new MutationObserver(mutations => {
            const wasScriptRemoved = mutations
                .filter(o => o.type === "childList")
                .flatMap(o => Array.from(o.removedNodes))
                .some(o => o.nodeName === "SCRIPT" && o.getAttribute("id") === `Data_Explorer_script`);
            
            if (wasScriptRemoved) {
                eventHandlers.forEach(({ element, event, handler }) => {
                    $(element).off(event, handler);
                });
                
                observer.disconnect();
                unmounting = true;
            }
        });
        
        observer.observe(document.body, { childList: true });
    }
    
    // Populates the global dailymap and weeklyMap
    function getData(rawData) {
        let countryYearMap = {};
        let wordMap = {};
        let eventMap = {};
        
        rawData.forEach(entry => {
            let description = entry.Description;
            let eventType = entry.Event_Type;
            let country = entry.Country_Involved;
            let date = entry.Date;
            let year = entry.Date.slice(0, 4);
            
            eventMap[eventType] = eventMap[eventType] || 0;
            eventMap[eventType]++;
            
            countryYearMap[country] = countryYearMap[country] || {};
            countryYearMap[country][year] = countryYearMap[country][year] || 0;
            countryYearMap[country][year]++;
            
            let wordList = description.split(" ");
            let currentWordMap = {};
            wordList.forEach(word => {
                let formattedWord = word.trim().toLowerCase();
                formattedWord = formattedWord.replace(/^[,\.\"]+|[,\.\"]+$|('s)/g, '');
                
                if (formattedWord != "") {
                    formattedWord = formattedWord[0].toUpperCase() + formattedWord.slice(1);
                
                    wordMap[formattedWord] = wordMap[formattedWord] || 0;
                    wordMap[formattedWord]++;
                    
                    currentWordMap[formattedWord] = currentWordMap[formattedWord] || 0;
                    currentWordMap[formattedWord]++;
                }
            })
            
            allData.push({
                "Country_Involved": country,
                "wordMap": currentWordMap,
                "Event_Type": eventType,
                "Date": date,
                "Year": year
            });
        });
        
        let tableData = [];
        let countryMap = {};
        let barChartData = {};
        Object.entries(countryYearMap).forEach(([country, years]) => {
            const totalCount = Object.values(years).reduce((accumulator, currentValue) => accumulator + currentValue);
            
            countryMap[country.toLowerCase()] = totalCount;
            barChartData[country] = totalCount;
            
            tableData.push({ 
                "Country": country, 
                "2021": countryYearMap[country]["2021"] || "",
                "2022": countryYearMap[country]["2022"] || "",
                "2023": countryYearMap[country]["2023"] || "",
                "2024": countryYearMap[country]["2024"] || "",
                "Total": totalCount
            })
        });
        
        let countryNames = countries.map(country => country.properties.WP_Name.toLowerCase());
        const mapValues = countryNames.map(country => (country in countryMap) ? countryMap[country] : 0);
        
        return [mapValues, wordMap, barChartData, eventMap, tableData];
    }
    
    function createChart1(ctx, mapValues) {
        
        Chart.defaults.scales.color.interpolate = "purples";
        
        // Global Styles
        Chart.defaults.font.size = 16;
        Chart.defaults.font.family = 'Roboto';
        Chart.defaults.color = '#000000';
        
        Chart.defaults.scale.beginAtZero = true;
        Chart.defaults.maintainAspectRatio = false;
        
        worldMap = new Chart(ctx, {
            type: 'choropleth',
            data: {
              labels: countries.map((d) => d.properties.WP_Name),
              datasets: [
                {
                  data: countries.map((d, i) => ({feature: d, value: mapValues[i]})),
                }
              ]
            },
            options: {
              showOutline: true,
              showGraticule: false,
              plugins: {
                legend: {
                  display: false
                }
              },
              scales: {
                projection: {
                  axis: 'x',
                  projection: 'mercator',
                  projectionOffset: [-100, 5],
                  projectionScale: 4.5
                }
              },
              onClick: function(event, elements) {
                  if (elements.length > 0) {
                      const name = elements[0].element.feature.properties.WP_Name;
                      
                      const selectAllButton = document.querySelectorAll("#Data_Explorer .filterCountry input")[0];
                      let clickedButton = Array.from(document.querySelectorAll("#Data_Explorer .filterCountry input"))
                          .filter(button => (button.parentNode.style.display != "none") && (button.value == name));
                      
                      if (clickedButton.length > 0) {
                          clickedButton = clickedButton[0];
                          
                          if (selectAllButton.checked == true) {
                          
                              // Click select button to uncheck
                              selectAllButton.click();
                            
                              // Click relevant country buttton
                              clickedButton.click();
                              
                          } else {
                              // Click relevant country buttton
                              clickedButton.click();
                              
                          }
                      }
                  }
              },
              onHover: function(event, elements) {
                  (elements.length > 0) ? (event.native.target.style.cursor = 'pointer') : (event.native.target.style.cursor = 'default');
              }
            }
        });
        
        const toolTipText = "The choropleth map visualizes engagement frequency for each country. Countries shaded darker have a higher frequency of engagements. Hover over each country to view exact counts. Click a country or countries to filter all visualizations for the selection. If you are having trouble viewing the entire map, collapse the sidebar by clicking the arrow."
        
        document.querySelector("#Data_Explorer .map-chart-container .chart-title").innerHTML = `<div style = "display: flex; justify-content: center">
            <div>
                Engagements by Country Map
            </div>
            <div class="d-lg-flex help-tooltip" data-toggle="tooltip" data-placement="top" title="` + toolTipText + `" style="align-items: center;">
                <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="circle-info" class="svg-inline--fa fa-circle-info fa-xs help-icon" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" id="tooltip-icon">
                    <path fill="currentColor" d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"></path>
                </svg>
            </div>
        </div>`;
        
        $("#Data_Explorer .map-chart-container .help-tooltip").tooltip();
    }
    
    function generateColor(fontSize, minFontSize, maxFontSize) {
        const minBrightness = 40;
        const maxBrightness = 60;
        const brightness = maxBrightness + ((fontSize - minFontSize) / (maxFontSize - minFontSize)) * (minBrightness - maxBrightness);
        return `hsl(285, 100%, ` + brightness + `%)`;
    }
    
    let counts = [];
    function createChart2(ctx, words, fontSizes) {
        
        const minFontSize = Math.min(...fontSizes);
        const maxFontSize = Math.max(...fontSizes);
        const colors = fontSizes.map(fontSize => generateColor(fontSize, minFontSize, maxFontSize));
    
        // Global Styles
        Chart.defaults.font.family = 'Roboto';
        Chart.defaults.color = '#000000';
        
        // Keep rotation at 0 degrees
        Chart.defaults.set('elements.word', {
            minRotation: 0
        })
        
        Chart.defaults.maintainAspectRatio = false;
        
        wordCloud = new Chart(ctx, {
          type: "wordCloud",
          data: {
            labels: words,
            datasets: [
              {
                label: "",
                data: fontSizes,
                color: colors
              }
            ]
          },
          options: {
            title: {
              display: false
            },
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                callbacks: {
                    label: (context) => counts[context.dataIndex]
                }
              }
            }
          }
        });
        
        const toolTipText = "The word cloud is generated based on the description of each engagement. The size of a word is indicative of the relative frequency of the occurrence of that word. Hover over each word to see the exact count."
        
        document.querySelector("#Data_Explorer .word-cloud-container .chart-title").innerHTML = `<div style = "display: flex; justify-content: center">
            <div>
                Word Cloud
            </div>
            <div class="d-lg-flex help-tooltip" data-toggle="tooltip" data-placement="top" title="` + toolTipText + `" style="align-items: center;">
                <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="circle-info" class="svg-inline--fa fa-circle-info fa-xs help-icon" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" id="tooltip-icon">
                    <path fill="currentColor" d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"></path>
                </svg>
            </div>
        </div>`;
        
        $("#Data_Explorer .word-cloud-container .help-tooltip").tooltip();
    }
    
    // Function that fetches the data from the API instead of using the Freemarker list to grab them one by one
    // Only update needed to this function is to change the 'formId=' to whichever form the new calendar is going to be copied to
    function fetchData() {
        return fetch('data/africa_russia_events.json')
            .then(function (response) {
                if (response.status === 200) {
                    return response.json();
                }
            })
            .catch(function (error) {
                console.log(error);
            });
    }
    
    function getFontSizes(values, minFont, maxFont) {
        const minCount = Math.min(...values);
        const maxCount = Math.max(...values);
        
        return values.map(value => {
            return Math.round(((value - minCount) / (maxCount - minCount)) * (maxFont - minFont) + minFont);
        });
    }
    
    function getWordCloudData(wordMap) {
        // Filter stop words
        let words = sw.removeStopwords(Object.keys(wordMap));
        
        let wordEntries = [];
        words.forEach(word => {
            wordEntries.push([word, wordMap[word]]);
        });
        
        /* entries sort and get top 50 words */
        wordEntries = wordEntries.sort((a, b) => b[1] - a[1]).slice(0, 50);
        
        // Get words from entries
        const topWords = wordEntries.map(entry => entry[0]);
        counts = wordEntries.map(entry => entry[1]);
        
        const fontSizes = getFontSizes(counts, 15, 80);
        
        return [topWords, fontSizes];
    }
    
    function buildTable(tableData) {
        
        let tableHTML = '<thead>' +
                            '<tr>' +
                                '<th class="basic-table-header" style="width: 40%">' +
                                    '<button class="btn header-dropdown" data-sort-direction="forward" data-format="string" type="button">' +
                                        'Country' +
                                    '</button>' +
                                '</th>' +
                                '<th class="basic-table-header" style="width: 12%">' +
                                    '<button class="btn header-dropdown" data-sort-direction="none" data-format="number" type="button">' +
                                        '2021' +
                                    '</button>' +
                                '</th>' +
                                '<th class="basic-table-header" style="width: 12%">' +
                                    '<button class="btn header-dropdown" data-sort-direction="none" data-format="number" type="button">' +
                                        '2022' +
                                    '</button>' +
                                '</th>' +
                                '<th class="basic-table-header" style="width: 12%">' +
                                    '<button class="btn header-dropdown" data-sort-direction="none" data-format="number" type="button">' +
                                        '2023' +
                                    '</button>' +
                                '</th>' +
                                '<th class="basic-table-header" style="width: 12%">' +
                                    '<button class="btn header-dropdown" data-sort-direction="none" data-format="number" type="button">' +
                                        '2024' +
                                    '</button>' +
                                '</th>' +
                                '<th class="basic-table-header" style="width: 12%">' +
                                    '<button class="btn header-dropdown" data-sort-direction="none" data-format="number" type="button">' +
                                        'Total' +
                                    '</button>' +
                                '</th>' +
                            '</tr>' +
                        '</thead>';
        
        // Begin adding body            
        tableHTML += '<tbody>';
        let totalCounts = {
            "2021": 0,
            "2022": 0,
            "2023": 0,
            "2024": 0
        };
        tableData = tableData.sort((a, b) => a.Country.localeCompare(b.Country));
        
        tableData.forEach((entry, index) => {
        
            totalCounts["2021"] += Number(entry["2021"]);
            totalCounts["2022"] += Number(entry["2022"]);
            totalCounts["2023"] += Number(entry["2023"]);
            totalCounts["2024"] += Number(entry["2024"]);
            
            tableHTML += '<tr class = "main-row">' +
                '<td style="width: 40%">' +
                    '<div style = "width: 98%">' +
                        entry["Country"] +
                    '</div>' +
                '</td>' +
                '<td style="width: 12%">' +
                    '<div style = "width: 98%">' +
                        entry["2021"] +
                    '</div>' +
                '</td>' +
                '<td style="width: 12%">' +
                    '<div style = "width: 98%">' +
                        entry["2022"] +
                    '</div>' +
                '</td>' +
                '<td style="width: 12%">' +
                    '<div style = "width: 98%">' +
                        entry["2023"] +
                    '</div>' +
                '</td>' +
                '<td style="width: 12%">' +
                    '<div style = "width: 98%">' +
                        entry["2024"] +
                    '</div>' +
                '</td>' +
                '<td style="width: 12%">' +
                    '<div style = "width: 98%">' +
                        entry["Total"] +
                    '</div>' +
                '</td>' +
            '</tr>';
        });
        
        totalCounts["Total"] = totalCounts["2021"] + totalCounts["2022"] + totalCounts["2023"]+ totalCounts["2024"];
        
        tableHTML += '<tr class = "last-row">' +
            '<td style="width: 40%">' +
                '<div style = "width: 98%">' +
                    "Total" +
                '</div>' +
            '</td>' +
            '<td style="width: 12%">' +
                '<div style = "width: 98%">' +
                    totalCounts["2021"] +
                '</div>' +
            '</td>' +
            '<td style="width: 12%">' +
                '<div style = "width: 98%">' +
                    totalCounts["2022"] +
                '</div>' +
            '</td>' +
            '<td style="width: 12%">' +
                '<div style = "width: 98%">' +
                    totalCounts["2023"] +
                '</div>' +
            '</td>' +
            '<td style="width: 12%">' +
                '<div style = "width: 98%">' +
                    totalCounts["2024"] +
                '</div>' +
            '</td>' +
            '<td style="width: 12%">' +
                '<div style = "width: 98%">' +
                    totalCounts["Total"] +
                '</div>' +
            '</td>' +
        '</tr>';
        
        // Close out body
        tableHTML += '</tbody>';
            
        let table = document.querySelector("#Data_Explorer table");
        
        table.innerHTML = tableHTML;
        
        const toolTipText = "The table shows the total number of engagements separated by country and year. Use the filters at the top of the data explorer to focus on particular subsets of the data."
        
        document.querySelector("#Data_Explorer .table-container .chart-title").innerHTML = `<div style = "display: flex; justify-content: center">
            <div>
                Engagements by Country and Year Table
            </div>
            <div class="d-lg-flex help-tooltip" data-toggle="tooltip" data-placement="top" title="` + toolTipText + `" style="align-items: center;">
                <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="circle-info" class="svg-inline--fa fa-circle-info fa-xs help-icon" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" id="tooltip-icon">
                    <path fill="currentColor" d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"></path>
                </svg>
            </div>
        </div>`;
        
        $("#Data_Explorer .pie-chart-container .help-tooltip").tooltip();
        
        addEventHandler("#Data_Explorer .header-dropdown", "click", sort);
    }
    
    function sortForward(button) {
        // Get list of rows
        const tbody = document.querySelector(`#Data_Explorer tbody`);
        const rows = Array.from(tbody.querySelectorAll('.main-row'));
        
        let buttons = document.querySelectorAll(`#Data_Explorer .header-dropdown`);
        let index = Array.from(buttons).indexOf(button);
        
        let number = (button.getAttribute('data-format') === "number");
        
        rows.sort((rowsA, rowsB) => {
            let cellA = rowsA.cells[index].textContent.trim().toLowerCase();
            let cellB = rowsB.cells[index].textContent.trim().toLowerCase();
            
            if (cellA == '' && cellB != '') return 1;
            if (cellB == '' && cellA != '') return -1;
            
            // Column is number
            if (number) {
                cellA = parseFloat(cellA) || 0;
                cellB = parseFloat(cellB) || 0;
            }
            
            return cellA > cellB ? 1 : cellA < cellB ? -1 : 0;
        });
        
        // Add sorted rows to tbody
        rows.forEach(row => tbody.appendChild(row));
        tbody.appendChild(tbody.querySelector(".last-row"));
        
        buttons.forEach(currentButton => {
            currentButton.setAttribute('data-sort-direction', 'none');
        })
        button.setAttribute('data-sort-direction', 'forward');
    }
    
    function sortReverse(button) {
        // Get list of rows
        const tbody = document.querySelector(`#Data_Explorer tbody`);
        const rows = Array.from(tbody.querySelectorAll('.main-row'));
        
        let buttons = document.querySelectorAll(`#Data_Explorer .header-dropdown`);
        let index = Array.from(buttons).indexOf(button);
        
        let number = (button.getAttribute('data-format') === "number");
        
        rows.sort((rowsA, rowsB) => {
            let cellA = rowsA.cells[index].textContent.trim().toLowerCase();
            let cellB = rowsB.cells[index].textContent.trim().toLowerCase();
            
            if (cellA == '' && cellB != '') return 1;
            if (cellB == '' && cellA != '') return -1;
            
            // Column is number
            if (number) {
                cellA = parseFloat(cellA) || 0;
                cellB = parseFloat(cellB) || 0;
            }
            
            return cellA < cellB ? 1 : cellA > cellB ? -1 : 0;
        });
        
        // Add sorted rows to tbody
        rows.forEach(row => tbody.appendChild(row));
        tbody.appendChild(tbody.querySelector(".last-row"));
        
        buttons.forEach(currentButton => {
            currentButton.setAttribute('data-sort-direction', 'none');
        })
        button.setAttribute('data-sort-direction', 'reverse');
    }
    
    function sort() {
        if (this.getAttribute('data-sort-direction') === "forward") {
            sortReverse(this);
        } else {
            sortForward(this);
        }
    }
    
    function createChart3(ctx, countries, data) {
    
        // Global Styles
        Chart.defaults.font.size = 16;
        Chart.defaults.font.family = 'Roboto';
        Chart.defaults.color = '#000000';
        
        Chart.defaults.maintainAspectRatio = false;
    
        barChart = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: countries,
              datasets: [
                {
                  data: data,
                  borderWidth: 1,
                  backgroundColor: 'rgba(88, 42, 129, 0.75)',
                }
              ]
            },
            options: {
                responsive: true,
                scales: {
                  x: {
                    title: {
                        display: true,
                        text: 'Countries'
                    },
                    ticks: {
                        minRotation: getRotationValue(ctx[0].offsetWidth),
                        callback: function(index) {
                            
                            let minRotation = getRotationValue(ctx[0].offsetWidth);
                            
                            if (barChart) {
                                barChart.options.scales.x.ticks.minRotation = minRotation;
                            }
                            
                            return this.chart.data.labels[index]
                        }
                    }
                  },
                  y: {
                    title: {
                       display: true,
                       text: 'Count'
                    }
                  }
                },
                onClick: function(event, elements) {
                  if (elements.length > 0) {
                      const index = elements[0].index
                      const name = barChart.data.labels[index];
                      
                      const clickedButton = Array.from(document.querySelectorAll("#Data_Explorer .filterCountry input"))
                          .filter(button => button.value == name)[0];
                      
                      // Click relevant country buttton
                      clickedButton.click();
                  }
                },
                onHover: function(event, elements) {
                  (elements.length > 0) ? (event.native.target.style.cursor = 'pointer') : (event.native.target.style.cursor = 'default');
                },
                plugins: {
                  legend: {
                    display: false
                  }
                }
            }
        });
        
        const toolTipText = "The bar chart displays the number of total engagements recorded for each country. Hover over each bar to see exact counts. Click each bar to remove a country or countries from all visualizations."
        
        document.querySelector("#Data_Explorer .bar-chart-container .chart-title").innerHTML = `<div style = "display: flex; justify-content: center">
            <div>
                Engagements by Country Bar Chart
            </div>
            <div class="d-lg-flex help-tooltip" data-toggle="tooltip" data-placement="top" title="` + toolTipText + `" style="align-items: center;">
                <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="circle-info" class="svg-inline--fa fa-circle-info fa-xs help-icon" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" id="tooltip-icon">
                    <path fill="currentColor" d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"></path>
                </svg>
            </div>
        </div>`;
        
        $("#Data_Explorer .bar-chart-container .help-tooltip").tooltip();
    }
    
    function getRotationValue(offsetWidth) {
        const minWidth = 400;
        const maxWidth = 800;
        
        if (offsetWidth >= maxWidth) {
            return 0;
        } else if (offsetWidth <= minWidth) {
            return 45;
        } else {
            const scale = (maxWidth - offsetWidth) / (maxWidth - minWidth);
            return scale * 45;
        }
    }
    
    function getPieChartData(eventMap, eventTypes) {
        let data = [];
        
        eventTypes.forEach(Event_Type => {
            data.push(eventMap[Event_Type]);
        });
        
        return data;
    }
    
    const backgroundColors = [
        { color: '#582a81', visible: true}, 
        { color: '#004E67', visible: true},
        { color: '#009696', visible: true},
        { color: '#6FC6E2', visible: true},   
        { color: '#CCE7EF', visible: true},    
        { color: '#582A81', visible: true},  
        { color: '#F6C144', visible: true},  
        { color: '#E57200', visible: true},
        { color: '#BC3340', visible: true},
        { color: '#0185AF', visible: true}
        // ... add more colors as needed
    ]
    
    function createChart4(ctx, labels, data) {
    
        // Global Styles
        Chart.defaults.font.size = 16;
        Chart.defaults.font.family = 'Roboto';
        Chart.defaults.color = '#000000';
        
        Chart.defaults.maintainAspectRatio = false;
    
        pieChart = new Chart(ctx, {
            type: 'pie',
            data: {
              labels: labels,
              datasets: [
                {
                  label: 'Africa HLE Event Type',
                  data: data,
                  backgroundColor: backgroundColors.filter(color => color.visible).map(color => color.color),
                  hoverOffset: 4
                }
              ]
            },
            options: {
              responsive: true,
              plugins: {
                  legend: {
                    display: false
                  }
                }
            }
        });
        
        createPieLegend();
        const toolTipText = "The pie chart shows engagements by event type. Hover to see exact event counts. Click event types in the legend to filter that category out of all visualizations."
        
        document.querySelector("#Data_Explorer .pie-chart-container .chart-title").innerHTML = `<div style = "display: flex; justify-content: center">
            <div>
                Engagements by Event Type Pie Chart
            </div>
            <div class="d-lg-flex help-tooltip" data-toggle="tooltip" data-placement="top" title="` + toolTipText + `" style="align-items: center;">
                <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="circle-info" class="svg-inline--fa fa-circle-info fa-xs help-icon" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" id="tooltip-icon">
                    <path fill="currentColor" d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"></path>
                </svg>
            </div>
        </div>`;
        
        $("#Data_Explorer .pie-chart-container .help-tooltip").tooltip();
    }
    
    function createPieLegend() {
    
        const colors = backgroundColors.filter(color => color.visible == true);
        const legendContainer = document.querySelector("#Data_Explorer #legend-container");
        
        legendHTML = `<ul style="display: flex; flex-flow: wrap; justify-content: center; margin: 0px; padding: 0px;">`;
        
        legendHTML += pieChart.data.labels.map((label, index) => {
            return `<li style="align-items: center; cursor: pointer; display: flex; flex-direction: row; margin-left: 10px;">
                <span style="background: ` + colors[index].color + `; border-color: rgb(255, 255, 255); border-width: 2px; border-style: solid; display: inline-block; flex-shrink: 0; height: 17px; margin-right: 8px; width: 39px;"></span>
                <p style="white-space: nowrap; color: rgb(0, 0, 0); margin: 0px; padding: 0px;">
                    ` + label + `
                </p>
            </li>`
        }).join('');
        
        legendHTML += `</ul><br>`
        legendContainer.innerHTML = legendHTML;
        
        addEventHandler("#Data_Explorer #legend-container li", "click", handleLegendClick);
    }
    
    function handleLegendClick() {
        const eventType = this.textContent.trim();
        
        // Toggle color visibility for chart
        const itemIndex = Array.from(this.parentElement.children).indexOf(this);
        backgroundColors[itemIndex].visible = !backgroundColors[itemIndex].visible;
        
        // Toggle line through style
        this.style.textDecoration = (this.style.textDecoration) ? '' : 'line-through';
        
        // Click relevant input in event filter dropdown
        const eventLabel = Array.from(document.querySelectorAll("#Data_Explorer .filterEventType label")).filter(label => label.textContent.trim() == eventType)[0];
        eventLabel.previousElementSibling.click();
    }
    
    function getPreviousDate(monthCount) {
        let currentDate = new Date();
        currentDate.setMonth(currentDate.getMonth() - monthCount);
        
        if (currentDate.getDate() != new Date().getDate()) {
            currentDate.setDate(0);
        }
        
        currentDate = currentDate.toLocaleDateString('en-CA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        
        return currentDate;
    }
    
    function buildDateFilter() {
        let dateFilterDropdownDiv = document.querySelector("#Data_Explorer .chart-filters");
        let dates = allData.map(entry => entry.Date).sort();
        
        let dateFilterDropdownHTML = '<div id="filter-date">' +
        '<button class="btn filter-dropdown" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">' + 
            'Filter Date&nbsp;' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-caret-down-square" viewBox="0 0 16 16">' +
                '<path d="M3.626 6.832A.5.5 0 0 1 4 6h8a.5.5 0 0 1 .374.832l-4 4.5a.5.5 0 0 1-.748 0l-4-4.5z"/>' +
                '<path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2z"/>' +
            '</svg>' +
        '</button>' +
        '<div class="dropdown-menu filterDate" style="overflow: auto;">' +
            '<div class="sort-section">';
        
        const earliestDate = dates[0];
        const latestDate = dates.at(-1);
        const previousDate2 = getPreviousDate(2);
        if ((earliestDate < previousDate2) && (latestDate > previousDate2)) {
            // include 2 month option
            dateFilterDropdownHTML += '<div>' +
                '&nbsp&nbsp<input type="radio" id="2_Months_Data_Explorer" name="2_Months_Data_Explorer" value="2_Months" style="cursor: pointer;">' + '&nbsp;' +
                '<label class="filter-dropdown-contains" for="2_Months_Data_Explorer" style = "font-weight: normal; cursor: pointer;">Last 2 Months</label>' +
            '</div>';
        }
        
        const previousDate3 = getPreviousDate(3);
        if ((earliestDate < previousDate3) && (latestDate > previousDate3)) {
            // include quarter option
            dateFilterDropdownHTML += '<div>' +
                '&nbsp&nbsp<input type="radio" id="Quarter_Data_Explorer" name="Quarter_Data_Explorer" value="3_Months" style="cursor: pointer;">' + '&nbsp;' +
                '<label class="filter-dropdown-contains" for="Quarter_Data_Explorer" style = "font-weight: normal; cursor: pointer;">Last Quarter</label>' +
            '</div>'
        }
        
        const previousDate6 = getPreviousDate(6);
        if ((earliestDate < previousDate6) && (latestDate > previousDate6)) {
            // include 6 month option
            dateFilterDropdownHTML += '<div>' +
                '&nbsp&nbsp<input type="radio" id="6_Months_Data_Explorer" name="6_Months_Data_Explorer" value="6_Months" style="cursor: pointer;">' + '&nbsp;' +
                '<label class="filter-dropdown-contains" for="6_Months_Data_Explorer" style = "font-weight: normal; cursor: pointer;">Last 6 Months</label>' +
            '</div>'
        }
        
        const previousDate12 = getPreviousDate(12);
        if ((earliestDate < previousDate12) && (latestDate > previousDate12)) {
            // include 12 month option
            dateFilterDropdownHTML += '<div>' +
                '&nbsp&nbsp<input type="radio" id="12_Months_Data_Explorer" name="12_Months_Data_Explorer" value="12_Months" style="cursor: pointer;">' + '&nbsp;' +
                '<label class="filter-dropdown-contains" for="12_Months_Data_Explorer" style = "font-weight: normal; cursor: pointer;">Last 12 Months</label>' +
            '</div>'
        }
        
        dateFilterDropdownHTML += '<div>' +
                    '&nbsp&nbsp<input type="radio" id="All_Data_Explorer" name=All_Data_Explorer" value="All_Dates" style="cursor: pointer;">' + '&nbsp;' +
                    '<label class="filter-dropdown-contains" for="All_Data_Explorer" style = "font-weight: normal; cursor: pointer;">All Dates</label>' +
                '</div>' +
                '<div>' +
                    '&nbsp&nbsp<input type="radio" id="Custom_Data_Explorer" name="Custom_Data_Explorer" value="Custom_Dates" style="cursor: pointer;">' + '&nbsp;' +
                    '<label class="filter-dropdown-contains" for="Custom_Data_Explorer" style = "font-weight: normal; cursor: pointer;">Custom</label>' +
                '</div>' +
                '<div>' +
                    '<p></p>' +
                    '&nbsp<b>Custom Begin Date</b>' +
                    '<div class = "date-slider-container">' +
                        '&nbsp;<label for="startDateSlider_Data_Explorer">Start Date: <span id="startDateDisplay"></span></label>' +
                        '&nbsp;<input type="range" id="startDateSlider_Data_Explorer" min="0" max="" value="0">' +
                    '</div>' +
                    '&nbsp<b>Custom End Date</b>' +
                    '<div class = "date-slider-container">' +
                        '&nbsp;<label for="endDateSlider_Data_Explorer">End Date: <span id="endDateDisplay"></span></label>' +
                        '&nbsp;<input type="range" id="endDateSlider_Data_Explorer" min="0" max="" value="0">&nbsp;' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div></div>';
        
        dateFilterDropdownDiv.innerHTML = dateFilterDropdownHTML;
        
        let beginDate = new Date(dates[0] + 'T00:00:00');
        let endDate = new Date(dates.at(-1) + 'T00:00:00');
        
        const diffTime = Math.abs(endDate - beginDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const startDateSlider = document.querySelector("#Data_Explorer input[id='startDateSlider_Data_Explorer']");
        const endDateSlider = document.querySelector("#Data_Explorer input[id='endDateSlider_Data_Explorer']");
        
        startDateSlider.max = diffDays;
        startDateSlider.value = 0;
        
        endDateSlider.max = diffDays;
        endDateSlider.value = diffDays;
        
        startDateSlider.setAttribute('start-date', dates[0]);
        startDateSlider.setAttribute('end-date', dates.at(-1));
        endDateSlider.setAttribute('start-date', dates[0]);
        endDateSlider.setAttribute('end-date', dates.at(-1));
        
        beginDate = beginDate.toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric'
        });
        endDate = endDate.toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric'
        });
        
        document.querySelector("#Data_Explorer label[for='startDateSlider_Data_Explorer']").textContent = beginDate;
        document.querySelector("#Data_Explorer label[for='endDateSlider_Data_Explorer']").textContent = endDate;
        document.querySelector("#All_Data_Explorer").checked = true;
        
        addEventHandler("#Data_Explorer .date-slider-container input", "input", updateSlider);
        addEventHandler("#Data_Explorer .date-slider-container input", "mouseup", () => {
            let customButton = document.querySelector("#Data_Explorer .filterDate input[name='Custom_Data_Explorer']");
            
            if (customButton.checked == true) {
                let checkedCountryButtons = Array.from(document.querySelectorAll("#Data_Explorer .filterCountry input:checked"))
                    .filter(countryInput => countryInput.parentElement.style.display !== "none");
                    
                if (checkedCountryButtons.length === 0) {
                    Array.from(document.querySelectorAll("#Data_Explorer .filterCountry input"))
                        .filter(countryInput => countryInput.parentElement.style.display !== "none")
                        .forEach(countryInput => {
                            countryInput.checked = true;
                            countriesRemoved.delete(countryInput.value)
                        });
                }
                
                let checkedEventTypeButtons = Array.from(document.querySelectorAll("#Data_Explorer .filterEventType input:checked"))
                    .filter(eventTypeInput => eventTypeInput.parentElement.style.display !== "none");
                
                if (checkedEventTypeButtons.length === 0) {
                    Array.from(document.querySelectorAll("#Data_Explorer .filterEventType input"))
                        .filter(eventTypeInput => eventTypeInput.parentElement.style.display !== "none")
                        .forEach(eventTypeInput => {
                            eventTypeInput.checked = true;
                            eventTypesRemoved.delete(eventTypeInput.value);
                        });
                }
                
                filterDate();
            }
        });
        
        addEventHandler("#Data_Explorer .filterDate input", "click", updateDateFilter);
        addEventHandler("#Data_Explorer .filterDate label", "click", updateDateFilter);
    }
    
    function updateSlider() {
        let label = this.parentNode.querySelector("label");
        let daysOffset = Number(this.value);
        
        let startDate = this.getAttribute('start-date');
        
        let beginDate = new Date(startDate + 'T00:00:00');
        
        let newDate = new Date(beginDate.getTime());
        
        newDate.setDate(beginDate.getDate() + daysOffset);
        
        label.textContent = newDate.toLocaleDateString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric'
        });
    }
    
    function updateDateFilter() {
        
        let checkedCountryButtons = Array.from(document.querySelectorAll("#Data_Explorer .filterCountry input:checked"))
            .filter(countryInput => countryInput.parentElement.style.display !== "none");
            
        if (checkedCountryButtons.length === 0) {
            Array.from(document.querySelectorAll("#Data_Explorer .filterCountry input"))
                .filter(countryInput => countryInput.parentElement.style.display !== "none")
                .forEach(countryInput => {
                    countryInput.checked = true;
                    countriesRemoved.delete(countryInput.value)
                });
        }
        
        let checkedEventTypeButtons = Array.from(document.querySelectorAll("#Data_Explorer .filterEventType input:checked"))
            .filter(eventTypeInput => eventTypeInput.parentElement.style.display !== "none");
        
        if (checkedEventTypeButtons.length === 0) {
            Array.from(document.querySelectorAll("#Data_Explorer .filterEventType input"))
                .filter(eventTypeInput => eventTypeInput.parentElement.style.display !== "none")
                .forEach(eventTypeInput => {
                    eventTypeInput.checked = true;
                    eventTypesRemoved.delete(eventTypeInput.value);
                });
        }
        
        let checkedDateButtons = Array.from(document.querySelectorAll("#Data_Explorer .filterDate input:checked"));
        
        if (checkedDateButtons.length > 1) {
            checkedDateButtons.forEach(button => button.checked = false);
            this.checked = true;
            
            filterDate();
        }
        
        event.stopPropagation();
    }
    
    function filterDateFilter() {
        let filteredDates = [];
        let dates = [];
        
        allData.forEach(submission => {
            let country = submission.Country_Involved;
            let eventType = submission.Event_Type;
            let date = submission.Date;
            
            if (!countriesRemoved.has(country) && !eventTypesRemoved.has(eventType)) {
                // Filter date filter
                filteredDates.push(date);
            }
            
            dates.push(date);
        });
        
        if (filteredDates.length != 0) {
            filteredDates.sort();
            
            let beginDate = new Date(filteredDates[0] + 'T00:00:00');
            let endDate = new Date(filteredDates.at(-1) + 'T00:00:00');
            
            let diffTime = Math.abs(endDate - beginDate);
            let diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            let maxValue = diffDays;
            
            beginDate = beginDate.toLocaleDateString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric'
            });
            endDate = endDate.toLocaleDateString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric'
            });
            
            const startDateSliderInput = document.querySelector("#Data_Explorer input[id='startDateSlider_Data_Explorer']");
            const endDateSliderInput = document.querySelector("#Data_Explorer input[id='endDateSlider_Data_Explorer']");
            const startDateSliderLabel = document.querySelector("#Data_Explorer label[for='startDateSlider_Data_Explorer']");
            const endDateSliderLabel = document.querySelector("#Data_Explorer label[for='endDateSlider_Data_Explorer']");
            
            if ((endDateSliderInput.getAttribute('start-date') !== filteredDates[0]) || (endDateSliderInput.getAttribute('end-date') !== filteredDates.at(-1))) {
                let newStartDate = new Date(filteredDates[0] + 'T00:00:00');
                let newEndDate = new Date(filteredDates.at(-1) + 'T00:00:00');
                
                let currentStartDate = new Date(startDateSliderLabel.textContent);
                let currentEndDate = new Date(endDateSliderLabel.textContent);
                
                let originalStartDate = new Date(startDateSliderInput.getAttribute('start-date') + 'T00:00:00');
                let originalEndDate = new Date(endDateSliderInput.getAttribute('end-date') + 'T00:00:00');
                    
                diffTime = originalStartDate - newStartDate;
                diffDays = Math.abs(Math.round(diffTime / (1000 * 60 * 60 * 24)));
                
                // Case when new start date is after original
                if (diffTime < 0) {
                    endDateSliderInput.value = Number.parseInt(endDateSliderInput.value) - diffDays;
                    endDateSliderInput.max = Number.parseInt(endDateSliderInput.max) - diffDays;
                    
                    startDateSliderInput.max = Number.parseInt(startDateSliderInput.max) - diffDays;
                    
                    if ((Number.parseInt(startDateSliderInput.value) - diffDays) > 0) {
                        startDateSliderInput.value = Number.parseInt(startDateSliderInput.value) - diffDays;
                    } else {
                        startDateSliderInput.value = 0;
                        startDateSliderLabel.textContent = beginDate;
                    }
                // Case when new start date is before original
                } else {
                    // min value 0 is not selected
                    if (startDateSliderInput.value !== "0") {
                        startDateSliderInput.value = Number.parseInt(startDateSliderInput.value) + diffDays;
                    } else {
                        startDateSliderLabel.textContent = beginDate;
                    }
                    endDateSliderInput.max = Number.parseInt(endDateSliderInput.max) + diffDays;
                    endDateSliderInput.value = Number.parseInt(endDateSliderInput.value) + diffDays;
                    startDateSliderInput.max = Number.parseInt(startDateSliderInput.max) + diffDays;
                }
                    
                diffTime = originalEndDate - newEndDate;
                diffDays = Math.abs(Math.round(diffTime / (1000 * 60 * 60 * 24)));
                
                // Case when new end date is before original end date
                if (diffTime > 0) {
                    if (maxValue < Number.parseInt(endDateSliderInput.value)) {
                        endDateSliderInput.value = maxValue;
                        endDateSliderLabel.textContent = endDate;
                    }
                    
                    startDateSliderInput.max = Number.parseInt(startDateSliderInput.max) - diffDays;
                    endDateSliderInput.max = Number.parseInt(endDateSliderInput.max) - diffDays;
                // case when new end date is after original end date
                } else {
                    // Max value is selected
                    if (endDateSliderInput.value === endDateSliderInput.max) {
                        endDateSliderInput.max = Number.parseInt(endDateSliderInput.max) + diffDays;
                        endDateSliderInput.value = Number.parseInt(endDateSliderInput.value) + diffDays;
                        endDateSliderLabel.textContent = endDate;
                    } else {
                        endDateSliderInput.max = Number.parseInt(endDateSliderInput.max) + diffDays;
                    }
                    startDateSliderInput.max = Number.parseInt(startDateSliderInput.max) + diffDays;
                }
                
                startDateSliderInput.setAttribute('start-date', filteredDates[0]);
                startDateSliderInput.setAttribute('end-date', filteredDates.at(-1));
                endDateSliderInput.setAttribute('start-date', filteredDates[0]);
                endDateSliderInput.setAttribute('end-date', filteredDates.at(-1));
            }
            
            let checkedDateFilter = document.querySelector("#Data_Explorer .filterDate input:checked");
            let dateFilterInputs = Array.from(checkedDateFilter.parentElement.parentElement.querySelectorAll("input"));
            dateFilterInputs.splice(dateFilterInputs.length - 4, 4);
            let previousDate = null;
            
            dateFilterInputs.forEach(dateFilterInput => {
                if (dateFilterInputs.length !== 0) {
                    switch (true) {
                        case dateFilterInput.id.startsWith("2_Months"):
                            previousDate = getPreviousDate(2);
                            break;
                        case dateFilterInput.id.startsWith("Quarter"):
                            previousDate = getPreviousDate(3);
                            break;
                        case dateFilterInput.id.startsWith("6_Months"):
                            previousDate = getPreviousDate(6);
                            break;
                        case dateFilterInput.id.startsWith("12_Months"):
                            previousDate = getPreviousDate(12);
                            break;
                    }
                    dateFilterInput.parentElement.style.display = (filteredDates.at(-1) < previousDate) ? "none" : "";
                }
            });
        }
        
        return dates.sort();
    }
    
    function filterDate() {
        
        let dates = filterDateFilter();
        let previousDate = null;
        let endDate = new Date();
        let labels;
        
        let checkedDateFilter = document.querySelector("#Data_Explorer .filterDate input:checked");
        const startDateSliderInput = document.querySelector("#Data_Explorer input[id='startDateSlider_Data_Explorer']");
        const endDateSliderInput = document.querySelector("#Data_Explorer input[id='endDateSlider_Data_Explorer']");
        
        switch (checkedDateFilter.id) {
            case '2_Months_Data_Explorer':
                previousDate = getPreviousDate(2);
                previousDate = (previousDate < dates[0]) ? dates[0] : previousDate;
                
                previousDate = new Date(previousDate + 'T00:00:00');
                break;
            case 'Quarter_Data_Explorer':
                previousDate = getPreviousDate(3);
                previousDate = (previousDate < dates[0]) ? dates[0] : previousDate;
                
                previousDate = new Date(previousDate + 'T00:00:00');
                break;
            case '6_Months_Data_Explorer':
                previousDate = getPreviousDate(6);
                previousDate = (previousDate < dates[0]) ? dates[0] : previousDate;
                
                previousDate = new Date(previousDate + 'T00:00:00');
                break;
            case '12_Months_Data_Explorer':
                previousDate = getPreviousDate(12);
                previousDate = (previousDate < dates[0]) ? dates[0] : previousDate;
                
                previousDate = new Date(previousDate + 'T00:00:00');
                break;
            case 'Custom_Data_Explorer':
                // Case when full date range is selected (default all dates)
                if ((startDateSliderInput.value == 0) && (endDateSliderInput.value == endDateSliderInput.max)) {
                    labels = new Set(dates);
                } else if (startDateSliderInput.value == 0) {
                    let endContent = document.querySelector("#Data_Explorer label[for='endDateSlider_Data_Explorer']").textContent;
                    
                    let endParts = endContent.split('/');
                    const endMonth = endParts[0].padStart(2, '0');
                    const endDay = endParts[1].padStart(2, '0');
                    const endYear = endParts[2];
                    
                    previousDate = dates[0];
                    endDate = endYear + '-' + endMonth + '-' + endDay;
                } else if (endDateSliderInput.value == endDateSliderInput.max) {
                    let startContent = document.querySelector("#Data_Explorer label[for='startDateSlider_Data_Explorer']").textContent;
                    
                    let startParts = startContent.split('/');
                    const startMonth = startParts[0].padStart(2, '0');
                    const startDay = startParts[1].padStart(2, '0');
                    const startYear = startParts[2];
                    
                    previousDate = startYear + '-' + startMonth + '-' + startDay;
                    endDate = dates.at(-1);
                } else {
                    let startContent = document.querySelector("#Data_Explorer label[for='startDateSlider_Data_Explorer']").textContent;
                    let endContent = document.querySelector("#Data_Explorer label[for='endDateSlider_Data_Explorer']").textContent;
                    
                    let startParts = startContent.split('/');
                    const startMonth = startParts[0].padStart(2, '0');
                    const startDay = startParts[1].padStart(2, '0');
                    const startYear = startParts[2];
                    
                    let endParts = endContent.split('/');
                    const endMonth = endParts[0].padStart(2, '0');
                    const endDay = endParts[1].padStart(2, '0');
                    const endYear = endParts[2];
                    
                    previousDate = startYear + '-' + startMonth + '-' + startDay;
                    endDate = endYear + '-' + endMonth + '-' + endDay;
                }
                
                break;
            case 'All_Data_Explorer':
            
                labels = new Set(dates);
                break;
        }
        
        if (previousDate) {
            if (checkedDateFilter.id != 'Custom_Data_Explorer') {
                previousDate = previousDate.toLocaleDateString('en-CA', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
                endDate = endDate.toLocaleDateString('en-CA', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                });
            }
            
            labels = new Set(dates.filter(date => date >= previousDate && date <= endDate));
        }
        
        let eventTypeFilters = document.querySelectorAll("#Data_Explorer .filterEventType input");
        let countryFilters = document.querySelectorAll("#Data_Explorer .filterCountry input");
        let eventTypeLegend = document.querySelectorAll("#Data_Explorer #legend-container li");
        
        let countryYearMap = {};
        let totalWordMap = {};
        let eventMap = {};
        let filteredDataCount = 0;
        
        let filteredCountries = new Set();
        let filteredEventTypes = new Set();
        
        allData.forEach(submission => {
            let date = submission.Date;
            
            if (labels.has(date)) {
                let country = submission.Country_Involved;
                let currentWordMap = submission.wordMap;
                let eventType = submission.Event_Type;
                let year = submission.Year;
                
                if (!countriesRemoved.has(country)) {
                    // Filter eventTypes filter
                    filteredEventTypes.add(eventType);
                }
                
                if (!eventTypesRemoved.has(eventType)) {
                    // Filter countries filter
                    filteredCountries.add(country);
                }
                
                if (!countriesRemoved.has(country) && !eventTypesRemoved.has(eventType)) {
                    countryYearMap[country] = countryYearMap[country] || {};
                    countryYearMap[country][year] = countryYearMap[country][year] || 0;
                    countryYearMap[country][year]++;
                    
                    Object.keys(currentWordMap).forEach(word => {
                        totalWordMap[word] = totalWordMap[word] || 0;
                        totalWordMap[word] += currentWordMap[word];
                    })
                    
                    eventMap[eventType] = eventMap[eventType] || 0;
                    eventMap[eventType]++;
                    
                    filteredDataCount++;
                }
            }
        });
        
        // No dates found that satisfy all criteria
        if (filteredDataCount == 0) modal.show();
        
        // Filter country dropdown options
        Array.from(countryFilters).slice(1).forEach(countryFilter => {
            let country = countryFilter.value;
            
            countryFilter.parentElement.style.display = (filteredCountries.has(country)) ? "" : "none";
        })
        
        let visibleUncheckedCountryInputs = Array.from(countryFilters).slice(1).filter(countryFilter => countryFilter.parentElement.style.display !== "none" && countryFilter.checked == false);
        countryFilters[0].checked = (visibleUncheckedCountryInputs.length > 0) ? false : true;
        
        // Filter event type dropdown options
        Array.from(eventTypeFilters).slice(1).forEach(eventTypeFilter => {
            let eventType = eventTypeFilter.value;
            
            eventTypeFilter.parentElement.style.display = (filteredEventTypes.has(eventType)) ? "" : "none";
        });
        
        let visibleUncheckedEventInputs = Array.from(eventTypeFilters).slice(1).filter(eventTypeFilter => eventTypeFilter.parentElement.style.display !== "none" && eventTypeFilter.checked == false);
        eventTypeFilters[0].checked = (visibleUncheckedEventInputs.length > 0) ? false : true;
        
        // Filter legend items
        let visibleEventTypes = [];
        Array.from(eventTypeLegend).forEach((item, index) => {
            let eventType = item.textContent.trim();
            
            if (filteredEventTypes.has(eventType)) {
                item.style.display = "flex";
                
                if (!item.style.textDecoration) {
                    backgroundColors[index].visible = true;
                    visibleEventTypes.push(eventType);
                }
            } else {
                item.style.display = "none";
                backgroundColors[index].visible = false;
            }
        })
        
        let pieChartData = getPieChartData(eventMap, visibleEventTypes);
        
        pieChart.data.labels = visibleEventTypes;
        pieChart.data.datasets[0].data = pieChartData;
        pieChart.data.datasets[0].backgroundColor = backgroundColors.filter(color => color.visible).map(color => color.color);
        
        let tableData = [];
        let countryMap = {};
        let barChartData = {};
        
        Object.entries(countryYearMap).forEach(([country, years]) => {
            const totalCount = Object.values(years).reduce((accumulator, currentValue) => accumulator + currentValue);
            
            countryMap[country.toLowerCase()] = totalCount;
            barChartData[country] = totalCount;
            
            tableData.push({ 
                "Country": country, 
                "2021": countryYearMap[country]["2021"] || "",
                "2022": countryYearMap[country]["2022"] || "",
                "2023": countryYearMap[country]["2023"] || "",
                "2024": countryYearMap[country]["2024"] || "",
                "Total": totalCount
            })
        });
        
        const countriesList = Object.keys(barChartData).sort((a, b) => barChartData[b] - barChartData[a]);
        const countList = countriesList.map(country => barChartData[country]);
        
        barChart.data.labels = countriesList;
        barChart.data.datasets[0].data = countList;
        
        let countryNames = countries.map(country => country.properties.WP_Name.toLowerCase());
        const mapValues = countryNames.map(country => (country in countryMap) ? countryMap[country] : 0);
        
        worldMap.data.datasets[0].data = worldMap.data.datasets[0].data.map((dataEntry, index) => {
            dataEntry.value = mapValues[index];
            return dataEntry;
        })
        
        const [topWords, fontSizes] = getWordCloudData(totalWordMap);
        
        if (topWords.length != 0) {
            const minFontSize = Math.min(...fontSizes);
            const maxFontSize = Math.max(...fontSizes);
            const colors = fontSizes.map(fontSize => generateColor(fontSize, minFontSize, maxFontSize));
            
            wordCloud.data.datasets[0].data = fontSizes;
            wordCloud.data.datasets[0].color = colors;
            wordCloud.data.labels = topWords;
        } else {
            wordCloud.data.datasets[0].data = [0];
            wordCloud.data.datasets[0].color = ['hsl(285, 100%, 0%)'];
            wordCloud.data.labels = [''];
        }
        
        wordCloud.update();
        worldMap.update();
        barChart.update();
        pieChart.update();
        
        buildTable(tableData);
        
        document.querySelector("#Data_Explorer .summary-count").innerHTML = `<div class = "summary-count">
            <p>Number of Events Recorded: ` + filteredDataCount + `</p>
        </div>`;
        
        const clearFiltersBtn = document.querySelector("#Data_Explorer .clear-filters-btn");
        
        const allDatesChecked = (checkedDateFilter.value === "All_Dates");
        const eventTypesChecked = Array.from(eventTypeFilters).every(input => input.checked == true)
        const countriesChecked = Array.from(countryFilters).every(input => input.checked == true)
        
        clearFiltersBtn.disabled = (allDatesChecked && eventTypesChecked && countriesChecked) ? true : false;
    }
    
    function buildCountryFilter(countries) {
        let countryFilterDropdownHTML = '<div id="filter-country">' + 
        '<button class="btn filter-dropdown" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">' + 
            'Filter Country&nbsp;' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-caret-down-square" viewBox="0 0 16 16">' +
                '<path d="M3.626 6.832A.5.5 0 0 1 4 6h8a.5.5 0 0 1 .374.832l-4 4.5a.5.5 0 0 1-.748 0l-4-4.5z"/>' +
                '<path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2z"/>' +
            '</svg>' +
        '</button>' +
        '<div class="dropdown-menu filterCountry">' +
            '<div class="sort-section" style="max-height: 300px; overflow-y: auto; overflow-x: hidden">';
        
        countryFilterDropdownHTML += `<a class="dropdown-item select-dropdown" href="#">
            <input class="input-box" type="checkbox" id="Select_All_0" placeholder="Yes" value="Select_All" style="cursor: pointer;">
            <label style="cursor: pointer;" class="menu-label header-dropdown-option" for="Select_All_0">(Select All)</label>
        </a>`;
        
        countries.forEach(country => {
            countryFilterDropdownHTML += `<a class="dropdown-item select-dropdown" href="#">
                <input class="input-box" type="checkbox" id="` + country + `" placeholder="Yes" value="` + country + `" style="cursor: pointer;">
                <label style="cursor: pointer;"class="menu-label header-dropdown-option" for="` + country + `">` + country + `</label>
            </a>`
        });
        
        document.querySelector("#Data_Explorer .chart-filters").insertAdjacentHTML('beforeEnd', countryFilterDropdownHTML);
        
        document.querySelectorAll("#Data_Explorer .filterCountry input").forEach(selectButton => {
            selectButton.checked = true;
        })
        
        // Check/Uncheck options when clicked
        addEventHandler("#Data_Explorer .filterCountry input", "click", updateSelectOptions);
        
        // Avoid Label click from triggering container click (triggers input click by default)
        addEventHandler("#Data_Explorer .filterCountry label", "click", event => event.stopPropagation());
        
        // Click the input if item container is clicked
        addEventHandler("#Data_Explorer .filterCountry .select-dropdown", "click", function() {
            this.querySelector("input").click();
        });
    }
    
    function addClearFiltersButton() {
        
        let clearFilterButtonHTML = `<div style = "display: flex; align-items: center">
            <button type="button" class="btn btn-sm clear-filters-btn" id="#Data_Explorer_ClearFilter" disabled="">
                Clear All Filters
            </button>
        </div>`;
        
        document.querySelector("#Data_Explorer .chart-filters").insertAdjacentHTML('beforeEnd', clearFilterButtonHTML);
        
        addEventHandler("#Data_Explorer .clear-filters-btn", "click", clearFilter);
    }
    
    function clearFilter() {
        countriesRemoved = new Set();
        eventTypesRemoved = new Set();
                
        // Remove line through all items in legend
        Array.from(document.querySelectorAll("#Data_Explorer #legend-container li"))
            .forEach(item => item.style.textDecoration = "");
        
        let dateInputs = document.querySelectorAll("#Data_Explorer .filterDate input");
        let countryInputs = document.querySelectorAll("#Data_Explorer .filterCountry input");
        let eventTypeInputs = document.querySelectorAll("#Data_Explorer .filterEventType input");
        
        dateInputs.forEach(input => (input.value == "All_Dates") ? (input.checked = true) : (input.checked = false));
        countryInputs.forEach(input => input.checked = true);
        eventTypeInputs.forEach(input => input.checked = true);
        
        // Reset sliders
        sliderInputs = document.querySelectorAll("#Data_Explorer .date-slider-container input");
        sliderInputs[0].value = 0;
        sliderInputs[1].value = Number.parseInt(sliderInputs[1].max);
        
        this.disabled = true;
        
        filterDate();
    }
    
    function updateSelectOptions() {
        
        // Avoid input click from triggering container click
        event.stopPropagation();
        
        const parent = this.parentElement.parentElement.parentElement;
        const selectButtons = Array.from(parent.querySelectorAll('input')).filter(input => input.parentElement.style.display !== "none");
        
        const inputs = (parent.classList.contains("filterCountry")) ? (document.querySelectorAll("#Data_Explorer .filterEventType input")) : (document.querySelectorAll("#Data_Explorer .filterCountry input"));
        const allNotChecked = Array.from(inputs).every(input => input.checked == false);
            
        if (allNotChecked) inputs.forEach(input => {
            input.checked = true;
            
            if (parent.classList.contains("filterCountry")) {
                eventTypesRemoved = new Set();
                
                // Remove line through all items in legend
                Array.from(document.querySelectorAll("#Data_Explorer #legend-container li"))
                    .forEach(item => item.style.textDecoration = "");
            } else {
                countriesRemoved = new Set();
            }
        });
        
        const adjustRemovedItems = (parent, action, value) => {
            if (action == "removeAll") {
                switch (true) {
                    case parent.classList.contains("filterCountry"):
                        countriesRemoved = new Set();
                        break;
                    case parent.classList.contains("filterEventType"):
                        eventTypesRemoved = new Set();
                        
                        // Remove line through all items in legend
                        Array.from(document.querySelectorAll("#Data_Explorer #legend-container li")).forEach((item, index) => {
                            item.style.textDecoration = "";
                            backgroundColors[index].visible = true;
                        });
                            
                        break;
                }
            } else if (action == "add") {
                switch (true) {
                    case parent.classList.contains("filterCountry"):
                        countriesRemoved.add(value);
                        break;
                    case parent.classList.contains("filterEventType"):
                        eventTypesRemoved.add(value);
                        
                        if (value != "Select_All") {
                            const itemsLegend = Array.from(document.querySelectorAll("#Data_Explorer #legend-container li"));
                            
                            // add line through item in legend
                            for (const [index, item] of itemsLegend.entries()) {
                                if (item.textContent.trim() == value) {
                                    item.style.textDecoration = "line-through";
                                    backgroundColors[index].visible = false;
                                    
                                    break;
                                }
                            }
                        }
                        
                        break;
                }
            } else if (action == "delete") {
                switch (true) {
                    case parent.classList.contains("filterCountry"):
                        countriesRemoved.delete(value);
                        break;
                    case parent.classList.contains("filterEventType"):
                        eventTypesRemoved.delete(value);
                        
                        if (value != "Select_All") {
                            const itemsLegend = Array.from(document.querySelectorAll("#Data_Explorer #legend-container li"));
                            
                            // add line through item in legend
                            for (const [index, item] of itemsLegend.entries()) {
                                if (item.textContent.trim() == value) {
                                    item.style.textDecoration = "";
                                    backgroundColors[index].visible = true;
                                    
                                    break;
                                }
                            }
                        }
                        
                        break;
                }
            }
        }
        
        if (this.value === "Select_All") {
            if (this.checked == true) {
                selectButtons.forEach(selectButton => selectButton.checked = true);
                adjustRemovedItems(parent, "removeAll");
            } else {
                selectButtons.forEach(selectButton => {
                    selectButton.checked = false;
                    adjustRemovedItems(parent, "add", selectButton.value);
                });
                return;
            }
        } else if (this.checked == true) {
            adjustRemovedItems(parent, "delete", this.value);
            const uncheckedButtons = selectButtons.slice(1).filter(selectButton => selectButton.checked === false);
            
            selectButtons[0].checked = (uncheckedButtons.length == 0) ? true : false;
        } else {
            adjustRemovedItems(parent, "add", this.value);
            selectButtons[0].checked = false;
        }
        
        filterDate();
    }
    
    function buildEventTypeFilter(eventTypes) {
        let eventTypeFilterDropdownHTML = '<div id="filter-event-type">' + 
        '<button class="btn filter-dropdown" type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">' + 
            'Filter Event Type&nbsp;' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="bi bi-caret-down-square" viewBox="0 0 16 16">' +
                '<path d="M3.626 6.832A.5.5 0 0 1 4 6h8a.5.5 0 0 1 .374.832l-4 4.5a.5.5 0 0 1-.748 0l-4-4.5z"/>' +
                '<path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2z"/>' +
            '</svg>' +
        '</button>' +
        '<div class="dropdown-menu filterEventType">' +
            '<div class="sort-section" style="max-height: 300px; overflow-y: auto; overflow-x: hidden">';
        
        eventTypeFilterDropdownHTML += `<a class="dropdown-item select-dropdown" href="#">
            <input class="input-box" type="checkbox" id="Select_All_0" placeholder="Yes" value="Select_All" style="cursor: pointer;">
            <label style="cursor: pointer;" class="menu-label header-dropdown-option" for="Select_All_0">(Select All)</label>
        </a>`;
        
        eventTypes.forEach(eventType => {
            eventTypeFilterDropdownHTML += `<a class="dropdown-item select-dropdown" href="#">
                <input class="input-box" type="checkbox" id="` + eventType + `" placeholder="Yes" value="` + eventType + `" style="cursor: pointer;">
                <label style="cursor: pointer;"class="menu-label header-dropdown-option" for="` + eventType + `">` + eventType + `</label>
            </a>`
        });
        
        document.querySelector("#Data_Explorer .chart-filters").insertAdjacentHTML('beforeEnd', eventTypeFilterDropdownHTML);
        
        document.querySelectorAll("#Data_Explorer .filterEventType input").forEach(selectButton => {
            selectButton.checked = true;
        });
        
        // Check/Uncheck options when clicked
        addEventHandler("#Data_Explorer .filterEventType input", "click", updateSelectOptions);
        
        // Avoid Label click from triggering container click (triggers input click by default)
        addEventHandler("#Data_Explorer .filterEventType label", "click", event => event.stopPropagation());
        
        // Click the input if item container is clicked
        addEventHandler("#Data_Explorer .filterEventType .select-dropdown", "click", function() {
            this.querySelector("input").click();
        });
    }
    
    async function init() {
    
        // Fetch the data from the form, wait until all the data has been fetched before proceeding
        let rawData = await fetchData();
        
        // Map Data from accessible section
        countries = await fetch("data/countriesData.geojson")
            .then((r) => r.json())
            .then((data) => {
                return data.features;
            })
    
        const topLevelElement = await waitForTopLevelElement();
        
        modal = new bootstrap.Modal(document.getElementById("showCaveat_Data_Explorer"));
        
        await import("https://cdn.jsdelivr.net/npm/chart.js")
        await import("https://cdn.jsdelivr.net/npm/chartjs-chart-geo")
        await import("https://cdn.jsdelivr.net/npm/chartjs-chart-wordcloud")
        await import("https://cdn.jsdelivr.net/npm/stopword")
        
        const [mapValues, wordMap, countryCounts, eventMap, tableData] = getData(rawData);
        
        buildDateFilter();
        
        const ctx1 = topLevelElement.find("#myChart1_Data_Explorer");
        createChart1(ctx1, mapValues);
        
        const [topWords, fontSizes] = getWordCloudData(wordMap);
        
        const ctx2 = topLevelElement.find("#myChart2_Data_Explorer");
        createChart2(ctx2, topWords, fontSizes);
        
        let countriesList = Object.keys(countryCounts).sort((a, b) => countryCounts[b] - countryCounts[a]);
        
        buildCountryFilter(Object.keys(countryCounts).sort());
        
        let countList = [];
        countriesList.forEach(country => {
            countList.push(countryCounts[country]);
        });
        
        const ctx3 = topLevelElement.find("#myChart3_Data_Explorer");
        createChart3(ctx3, countriesList, countList);
        
        // Sort by count
        let eventTypes = Object.entries(eventMap)
            .sort((a, b) => b[1] - a[1])
            .map(entry => entry[0]);
            
        buildEventTypeFilter(Object.keys(eventMap).sort());
        
        addClearFiltersButton();
        
        let pieChartData = getPieChartData(eventMap, eventTypes);
        
        const ctx4 = topLevelElement.find("#myChart4_Data_Explorer");
        createChart4(ctx4, eventTypes, pieChartData);
        
        buildTable(tableData);
        
        let summaryCount = `<p style="margin: 0;">Number of Events Recorded: ` + rawData.length + `</p>`;
        document.querySelector("#Data_Explorer .summary-count").innerHTML = summaryCount;
        
        addEventHandler("#Data_Explorer .dropdown-menu", "click", function(event) {
            event.stopPropagation();
        });

        console.log(Array.from(document.querySelectorAll('.help-tooltip')))

        Array.from(document.querySelectorAll('.help-tooltip')).forEach(tooltipTriggerEl => {
            new bootstrap.Tooltip(tooltipTriggerEl);
        });
        
        configureCleanup();
    }
    init();
})();