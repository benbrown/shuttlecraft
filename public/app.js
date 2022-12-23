const fetch = (url, type, payload = undefined) => {
    return new Promise((resolve, reject) => {
        const Http = new XMLHttpRequest();
        Http.open(type, url);
        // TODO: should be a parameter
        Http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        Http.send(payload);

        Http.onreadystatechange = () => {
            if (Http.readyState == 4 && Http.status == 200) {
                resolve(Http.responseText);
            } else if (Http.readyState == 4 && Http.status >= 300) {
                reject(Http.statusText);
            }

        }
    });
}

const setCookie = (name,value,days) => {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days*24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}
const getCookie = (name) => {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

const app = {
    newPosts: 0,
    newNotifications: 0,
    latestPost: (date) => {
        setCookie('latestPost', date, 7);
    },
    latestNotification: (date) => {
        setCookie('latestNotification', date, 7);
    },
    toggleCW: (id) => {
        if (document.getElementById(id).classList.contains('collapsed')) {
            document.getElementById(id).classList.remove('collapsed');
        } else {
            document.getElementById(id).classList.add('collapsed');
        }
    },
    alertNewPosts: (meta) => {
        const newPosts = document.getElementById('newPosts') || document.getElementById('newPostsBadge');
        if (newPosts) {
            if (meta.newPosts > 0) {
                if (meta.newPosts > app.newPosts) {
                    // BEEP!
                    console.log('BEEP!');
                }
                app.newPosts = meta.newPosts;
                newPosts.innerHTML = `${meta.newPosts}<span> unread</span>`;
                newPosts.hidden = false;
            } else {
                newPosts.innerHTML = '';
                newPosts.hidden = true;
            }
        }
        const newNotifications = document.getElementById('newNotifications') || document.getElementById('newNotificationsBadge');
        if (newNotifications) {
            if (meta.newNotifications > 0) {
                if (meta.newNotifications > app.newNotifications) {
                    // BEEP!
                    console.log('BEEP!');
                }
                app.newNotifications = meta.newNotifications;
                newNotifications.innerHTML = `${meta.newNotifications}<span> new</span>`;
                newNotifications.hidden = false;
            } else {
                newNotifications.innerHTML = '';
                newNotifications.hidden = true;
            }
        }
        const newDMs = document.getElementById('newDMs') || document.getElementById('newDMsBadge');
        if (newDMs) {
            if (meta.newDMs > 0) {
                if (meta.newDMs > app.newDMs) {
                    // BEEP!
                    console.log('BEEP!');
                }
                app.newDMs = meta.newDMs;
                newDMs.innerHTML = `${meta.newDMs}<span> new</span>`;
                newDMs.hidden = false;
            } else {
                newDMs.innerHTML = '';
                newDMs.hidden = true;
            }
        }

    },
    pollForPosts: () => {
        fetch('/private/poll','get').then((json) => {
            const res = JSON.parse(json);
            app.alertNewPosts(res);
            setTimeout(() => app.pollForPosts(), 30000); // poll every 5 seconds
        }).catch((err) => {
            console.error(err);
        });
    },
    toggleBoost: (el, postId) => {
        const Http = new XMLHttpRequest();
        const proxyUrl ='/private/boost';
        Http.open("POST", proxyUrl);
        Http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        Http.send(JSON.stringify({
            post: postId,
        }));

        Http.onreadystatechange = () => {
            if (Http.readyState == 4 && Http.status == 200) {
                const resRaw = Http.responseText;
                const res = JSON.parse(resRaw);
                if (res.isBoosted) {
                    console.log('boosted!');
                    el.classList.add("active");
                } else {
                    console.log('unboosted');
                    el.classList.remove("active");
                }
            } else {
                console.error('HTTP PROXY CHANGE', Http);
            }
        }
        return false;
    },
    toggleLike: (el, postId) => {
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
        const inReplyTo = document.getElementById('inReplyTo');
        const to = document.getElementById('to');
        // get hidden elements for poll choices (replying to poll)
        const names = Array.from(document.querySelectorAll('input[class="pollchoice"]')).map((item) => {return item.value});
        // get hidden element for poll designer (sending a new poll)
        let polldata;
        if (document.getElementById('polldata')) {
            polldata = JSON.parse(document.getElementById('polldata').value);
        }

        const Http = new XMLHttpRequest();
        const proxyUrl ='/private/post';
        Http.open("POST", proxyUrl);
        Http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        Http.send(JSON.stringify({
            post: post.value,
            cw: cw.value,
            inReplyTo: inReplyTo.value,
            to: to.value,
            names: names,   // list of things being voted for
            polldata: polldata // poll being created by user
        }));

        Http.onreadystatechange = () => {
            if (Http.readyState == 4 && Http.status == 200) {
                console.log('posted!');

                // prepend the new post
                const newHtml = Http.responseText;
                const el = document.getElementById('home_stream') || document.getElementById('inbox_stream');

                if (!el) {
                    window.location = '/private/';
                }

                // todo: ideally this would come back with all the html it needs
                el.innerHTML = newHtml + el.innerHTML;

                // reset the inputs to blank
                post.value = '';
                cw.value = '';
            } else {
                console.error('HTTP PROXY CHANGE', Http);
            }
        }
        return false;
    },
    replyTo: (activityId, mention) => {
        // get poll form response
        let pollChoices = [];
        Array.from(document.getElementById(activityId).getElementsByTagName('input')).forEach((inp) => {
            if (inp.checked) {
                pollChoices.push(inp.value);
            }
        });
        if (pollChoices.length > 0) {
            window.location = '/private/post?inReplyTo=' + activityId + '&names=' + encodeURIComponent(JSON.stringify(pollChoices));;
        } else {
            window.location = '/private/post?inReplyTo=' + activityId;
        }
        return;

        const inReplyTo = document.getElementById('inReplyTo');
        const post = document.getElementById('post');
        post.value = `@${ mention } `;
        inReplyTo.value = activityId;
        post.focus();
    },
    toggleFollow: (el, userId) => {
        const Http = new XMLHttpRequest();
        const proxyUrl ='/private/follow';
        Http.open("POST", proxyUrl);
        Http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        Http.send(JSON.stringify({
            handle: userId,
        }));

        Http.onreadystatechange = () => {
            if (Http.readyState == 4 && Http.status == 200) {
                console.log('followed!');
                const resRaw = Http.responseText;
                const res = JSON.parse(resRaw);

                if (res.isFollowed) {
                    console.log('followed!');
                    el.classList.add("active");
                } else {
                    console.log('unfollowed');
                    el.classList.remove("active");
                }
            } else {
                console.error('HTTP PROXY CHANGE', Http);
            }
        }
        return false;
    },    
    lookup: () => {
        const follow = document.getElementById('lookup');
        const lookup_results = document.getElementById('lookup_results');

        console.log('Lookup user', follow.value);

        const Http = new XMLHttpRequest();
        const proxyUrl ='/private/lookup?handle=' + encodeURIComponent(follow.value);
        console.log(proxyUrl);

        Http.open("GET", proxyUrl);
        Http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        Http.send();

        Http.onreadystatechange = () => {
            if (Http.readyState == 4 && Http.status == 200) {
                lookup_results.innerHTML = Http.responseText;
            } else {
                console.error('HTTP PROXY CHANGE', Http);
            }
        }
        return false;
    }    
}
