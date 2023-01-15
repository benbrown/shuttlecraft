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
    newDMs: 0,
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
        const newPosts = document.getElementById('newPosts') ?  [document.getElementById('newPosts')] : Array.from(document.getElementsByClassName('newPostsBadge'));
        if (newPosts) {
            if (meta.newPosts > 0) {
                if (meta.newPosts > app.newPosts) {
                    // BEEP!
                    console.log('BEEP!');
                }
                app.newPosts = meta.newPosts;
                newPosts.forEach((badge) => {
                    badge.innerHTML = `${meta.newPosts}<span> unread</span>`;
                    badge.hidden = false;
                });
            } else {
                newPosts.forEach((badge) => {
                    badge.innerHTML = '';
                    badge.hidden = true;
                });
            }
        }
        const newNotifications = document.getElementById('newNotifications') ? [document.getElementById('newNotifications')] : Array.from(document.getElementsByClassName('newNotificationsBadge'));
        if (newNotifications) {
            if (meta.newNotifications > 0) {
                if (meta.newNotifications > app.newNotifications) {
                    // BEEP!
                    console.log('BEEP!');
                }
                app.newNotifications = meta.newNotifications;
                newNotifications.forEach((badge) => {
                    badge.innerHTML = `${meta.newNotifications}<span> unread</span>`;
                    badge.hidden = false;
                });
            } else {
                newNotifications.forEach((badge) => {
                    badge.innerHTML = '';
                    badge.hidden = true;
                });
            }
        }
        const newDMs = document.getElementById('newDMs') ? [document.getElementById('newDMs')] : Array.from(document.getElementsByClassName('newDMsBadge'));
        if (newDMs) {
            if (meta.newDMs > 0) {
                if (meta.newDMs > app.newDMs) {
                    // BEEP!
                    console.log('BEEP!');
                }
                app.newDMs = meta.newDMs;
                newDMs.forEach((badge) => {
                    badge.innerHTML = `${meta.newDMs}<span> unread</span>`;
                    badge.hidden = false;
                });
            } else {
                newDMs.forEach((badge) => {
                    badge.innerHTML = '';
                    badge.hidden = true;
                });

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
        if (el.classList.contains('busy')) return;

        el.classList.add('busy');
        fetch('/private/boost', 'POST', JSON.stringify({
            post: postId,
        })).then((resRaw) => {
            el.classList.remove('busy');
            const res = JSON.parse(resRaw);
            if (res.isBoosted) {
                console.log('boosted!');
                el.classList.add("active");
            } else {
                console.log('unboosted');
                el.classList.remove("active");
            }
        }).catch((err) => {
            console.error(err);
            el.classList.remove('busy');
        });
        return false;
    },
    toggleLike: (el, postId) => {
        if (el.classList.contains('busy')) return;

        el.classList.add('busy');

        fetch('/private/like', 'POST', JSON.stringify({
            post: postId,
        })).then((resRaw) => {
            el.classList.remove('busy');
            const res = JSON.parse(resRaw);
            if (res.isLiked) {
                console.log('liked!');
                el.classList.add("active");
            } else {
                console.log('unliked');
                el.classList.remove("active");
            }
        }).catch((err) => {
            console.error(err);
            el.classList.remove('busy');
        });
        return false;
    },
    editPost: (postId) => {
        console.log("EDIT POST", postId);
        window.location = '/private/post?edit=' + encodeURIComponent(postId);
    },
    post: () => {
        const post = document.getElementById('post');
        const cw = document.getElementById('cw');
        const inReplyTo = document.getElementById('inReplyTo');
        const to = document.getElementById('to');
        const editOf = document.getElementById('editOf');

        const form = document.getElementById('composer_form');
        
        form.disabled = true;

        fetch('/private/post', 'POST', JSON.stringify({
            post: post.value,
            cw: cw.value,
            inReplyTo: inReplyTo.value,
            to: to.value,
            editOf: editOf ? editOf.value : null
        })).then((newHtml) => {
            // prepend the new post
            const el = document.getElementById('home_stream') || document.getElementById('inbox_stream');

            if (!el) {
                window.location = '/private/';
            } else {
                form.disabled = false;
            }

            el.innerHTML = newHtml + el.innerHTML;

            // reset the inputs to blank
            post.value = '';
            cw.value = '';
        }).catch((err) => {
            console.error(err);
        });
        return false;
    },
    replyTo: (activityId, mention) => {
        window.location = '/private/post?inReplyTo=' + activityId;
    },
    toggleFollow: (el, userId) => {
        if (el.classList.contains('busy')) return;

        el.classList.add('busy');
        fetch('/private/follow','POST',JSON.stringify({
            handle: userId,
        })).then((resRaw) => {
            el.classList.remove('busy');

            console.log('followed!');
            const res = JSON.parse(resRaw);

            if (res.isFollowed) {
                console.log('followed!');
                el.classList.add("active");
            } else {
                console.log('unfollowed');
                el.classList.remove("active");
            }
        }).catch((err) => {
            console.error(err);
            el.classList.remove('busy');
        });
        return false;
    },    
    loadMoreFeeds: () => {
        const el = document.getElementById('top_feeds');
        fetch('/private/morefeeds', 'GET', null)
            .then((newHTML) => {
                const morelink = el.childNodes[el.childNodes.length-1];
                morelink.remove();
                el.innerHTML = el.innerHTML + newHTML;
            });
        return false;
    },
    lookup: () => {
        const follow = document.getElementById('lookup');
        const lookup_results = document.getElementById('lookup_results');

        console.log('Lookup user', follow.value);
        fetch('/private/lookup?handle=' + encodeURIComponent(follow.value), 'GET', null)
            .then((newHTML) => {
                lookup_results.innerHTML = newHTML;
            });
        return false;
    }    
}
