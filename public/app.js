
const app = {
    toggleLike: (el, postId) => {
        const post = document.getElementById('post');
        const cw = document.getElementById('cw');

        const Http = new XMLHttpRequest();
        const proxyUrl ='/private/like';
        Http.open("POST", proxyUrl);
        Http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        Http.send(JSON.stringify({
            post: postId,
        }));

        Http.onreadystatechange = () => {
            if (Http.readyState == 4 && Http.status == 200) {
                const resRaw = Http.responseText;
                const res = JSON.parse(resRaw);
                if (res.isLiked) {
                    console.log('liked!');
                    el.classList.add("active");
                } else {
                    console.log('unliked');
                    el.classList.remove("active");
                }
            } else {
                console.error('HTTP PROXY CHANGE', Http);
            }
        }
        return false;
    },
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
    },
    follow: () => {
        const follow = document.getElementById('follow');

        const Http = new XMLHttpRequest();
        const proxyUrl ='/private/follow';
        Http.open("POST", proxyUrl);
        Http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        Http.send(JSON.stringify({
            handle: follow.value,
        }));

        Http.onreadystatechange = () => {
            if (Http.readyState == 4 && Http.status == 200) {
                console.log('followed!');
                post.value = '';
            } else {
                console.error('HTTP PROXY CHANGE', Http);
            }
        }
        return false;
    }    
}