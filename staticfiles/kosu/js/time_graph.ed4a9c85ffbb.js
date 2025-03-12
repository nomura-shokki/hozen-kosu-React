const colorMapping = {
    1: 'plum', 2: 'darkgray', 3: 'slategray', 4: 'steelblue', 5: 'royalblue',
    6: 'dodgerblue', 7: 'deepskyblue', 8: 'aqua', 9: 'mediumturquoise',
    10: 'lightseagreen', 11: 'springgreen', 12: 'limegreen', 13: 'lawngreen',
    14: 'greenyellow', 15: 'gold', 16: 'darkorange', 17: 'burlywood',
    18: 'sandybrown', 19: 'lightcoral', 20: 'lightsalmon', 21: 'tomato',
    22: 'orangered', 23: 'red', 24: 'deeppink', 25: 'hotpink', 26: 'violet',
    27: 'magenta', 28: 'mediumorchid', 29: 'darkviolet', 30: 'mediumpurple',
    31: 'mediumblue', 32: 'cadetblue', 33: 'mediumseagreen', 34: 'forestgreen',
    35: 'darkkhaki', 36: 'crimson', 37: 'rosybrown', 38: 'dimgray', 39: 'midnightblue',
    40: 'darkblue', 41: 'darkslategray', 42: 'darkgreen', 43: 'olivedrab', 44: 'darkgoldenrod',
    45: 'sienna', 46: 'firebrick', 47: 'maroon', 48: 'darkmagenta', 49: 'indigo',
    50: 'black'
  };
  
  function updateBackgroundColors(datasets) {
    datasets.forEach(dataset => {
      dataset.data.forEach((value, index) => {
        dataset.backgroundColor[index] = colorMapping[value] || '#FFFFFF';
      });
    });
  }
  
  function createChart(ctxSelector, labelList, dataList) {
    const datasets = [{
      data: dataList,
      backgroundColor: new Array(dataList.length).fill('#FFFFFF'),
      barPercentage: 1,
      categoryPercentage: 1,
    }];
  
    updateBackgroundColors(datasets);
  
    const ctx = document.querySelector(ctxSelector);
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labelList,
        datasets: datasets
      },
      options: {
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            display: false,
            max: 1,
            min: 0,
          },
        },
      }
    });
  }
  
  createChart('#chart1', label_list1, data_list1);
  createChart('#chart2', label_list2, data_list2);
  createChart('#chart3', label_list3, data_list3);
  createChart('#chart4', label_list4, data_list4);
  createChart('#chart5', label_list5, data_list5);
  createChart('#chart6', label_list6, data_list6);
  createChart('#chart7', label_list7, data_list7);
  createChart('#chart8', label_list8, data_list8);
  createChart('#chart9', label_list9, data_list9);
  createChart('#chart10', label_list10, data_list10);
  createChart('#chart11', label_list11, data_list11);
  createChart('#chart12', label_list12, data_list12);
  createChart('#chart13', label_list13, data_list13);
  createChart('#chart14', label_list14, data_list14);
  createChart('#chart15', label_list15, data_list15);