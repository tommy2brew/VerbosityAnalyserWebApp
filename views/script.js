//hamburger menu functionality
document.getElementById("burger").addEventListener("click", function(){
    links = document.getElementById("links");
    if (links.style.display === "flex"){
        links.style.display = "none";
    }
    else{
        links.style.display = "flex";
    }
});

document.getElementById("login").addEventListener("click", function(){
    window.location.href = '/login';
})