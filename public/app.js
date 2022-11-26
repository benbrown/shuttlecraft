
const app = {
    post: () => {
        const post = document.getElementById('post');
        const cw = document.getElementById('cw');

        const Http = new XMLHttpRequest();
        const proxyUrl ='/private/post';
        Http.open("POST", proxyUrl);
        Http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        Http.send(JSON.stringify({
            post: post.value,
            cw: cw.value,
        }));

        Http.onreadystatechange = () => {
            if (Http.readyState == 4 && Http.status == 200) {
                console.log('bookmarked!');
                post.value = '';
                cw.value = '';
            } else {
                console.error('HTTP PROXY CHANGE', Http);
            }
        }
        return false;
    }
}