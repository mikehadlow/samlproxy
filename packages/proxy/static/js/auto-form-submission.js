const myForm = document.getElementById("assertion-form");
// delay form submission by 1 second
// just so that we can see the pretty animation and know that
// the proxy is doing its job
setTimeout(() => {
    myForm.submit();
}, 1000);
