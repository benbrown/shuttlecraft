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

const beep = () => {
    console.log("BEEP!");
    // https://stackoverflow.com/a/23395136/283981
    // https://dopiaza.org/tools/datauri/index.php
    var snd = new Audio("data:audio/x-wav;base64,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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
    snd.play();
}

const app = {
    firstPoll: true,
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
                    beep();
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
                    beep();
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
                    beep();
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
        fetch('/private/poll' + (app.firstPoll ? '?nowait=1' : ''),'get').then((json) => {
            app.firstPoll = false;
            const res = JSON.parse(json);
            app.alertNewPosts(res);
            setTimeout(() => app.pollForPosts(), 1000); // poll every 1 seconds, endpoint will stall until event occurs
        }).catch((err) => {
            console.error(err);
            setTimeout(() => app.pollForPosts(), 1000); // poll every 1 seconds, endpoint will stall until event occurs
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
    settings: () => {
        const summary = document.getElementById('summary');
        let attachment_header;
        let attachment_avatar;

        app.readAttachment('avatarupload').then((att) => {
            attachment_avatar = att;
            return app.readAttachment('headerupload').then((att) => {
                attachment_header = att;

                const Http = new XMLHttpRequest();
                const proxyUrl ='/private/settings';
                Http.open("POST", proxyUrl);
                Http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
                Http.send(JSON.stringify({
                    attachment_avatar: attachment_avatar,
                    attachment_header: attachment_header,
                    account: {
                        actor: {
                            summary: summary.value
                        }
                    }
                }));

                Http.onreadystatechange = () => {
                    if (Http.readyState == 4 && Http.status == 200) {
                        console.log('posted!');
                        window.location = '/private/settings';
                    } else {
                        console.error('HTTP PROXY CHANGE', Http);
                    }
                }
            });
        });
        return false;
    },
    readAttachment: async (id) => {
        // read the file into base64, return mimetype and data
        if (document.getElementById(id)) {
            const files = document.getElementById(id).files;
            return new Promise((resolve, reject) => {
                if (files && files[0]) {
                    let f = files[0];   // only read the first file
                    let reader = new FileReader();
                    reader.onload = (function(theFile) {
                        return function(e) {
                            let base64 = btoa(
                                new Uint8Array(e.target.result)
                                    .reduce((data, byte) => data + String.fromCharCode(byte), '')
                                );
                            resolve({type: f.type, data: base64});
                        };
                    })(f);
                    reader.readAsArrayBuffer(f);
                } else {
                    resolve(null);
                }
            });
        } else {
            return Promise.resolve(null);
        }
    },
    editPost: (postId) => {
        window.location = '/private/post?edit=' + encodeURIComponent(postId);
    },
    post: () => {
        const post = document.getElementById('post');
        const cw = document.getElementById('cw');
        const inReplyTo = document.getElementById('inReplyTo');
        const to = document.getElementById('to');
        const editOf = document.getElementById('editOf');
        const description = document.getElementById('description');

        // get hidden elements for poll choices (replying to poll)
        const names = Array.from(document.querySelectorAll('input[class="pollchoice"]')).map((item) => {return item.value});
        // get hidden element for poll designer (sending a new poll)
        let polldata;
        if (document.getElementById('polldata') && document.getElementById('polldata').value) {
            polldata = JSON.parse(document.getElementById('polldata').value);
            if (polldata.choices.includes(null)) {
                polldata = null;    // invalid options
            }
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
            editOf: editOf ? editOf.value : null
        }));

        app.readAttachment('attachment').then((attachment) => {
            const Http = new XMLHttpRequest();
            const proxyUrl ='/private/post';
            Http.open("POST", proxyUrl);
            Http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
            Http.send(JSON.stringify({
                post: post.value,
                cw: cw.value,
                inReplyTo: inReplyTo.value,
                to: to.value,
                attachment: attachment,
                description: description ? description.value : '',
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
        });
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
