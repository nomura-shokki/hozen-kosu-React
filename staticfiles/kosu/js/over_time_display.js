function increment(element) {
    let input = element.parentNode.querySelector('input[type=number]');
    input.value = parseInt(input.value) + 15 || 0; 
}
  
function decrement(element) {
    let input = element.parentNode.querySelector('input[type=number]');
    input.value = parseInt(input.value) - 15 || 0;
}