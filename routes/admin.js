import {
    getActivity,
    getActivitySince,
    getActivityStream
} from '../lib/notes.js';
import express from 'express';
export const router = express.Router();
import debug from 'debug';
import {
    getFollowers,
    getFollowing,
    writeFollowing,
    createNote,
    getNotifications,
    getNote,
    getLikes,
    writeLikes,
    getBoosts,
    writeBoosts,
    isFollower,
    isFollowing,
    getInboxIndex,
    getInbox,
    writeInboxIndex,

} from '../lib/account.js';
import {
    fetchUser
} from '../lib/users.js';
import {
    INDEX,
    searchKnownUsers,
} from '../lib/storage.js';
import {
    ActivityPub
} from '../lib/ActivityPub.js';
const logger = debug('ono:admin');

router.get('/index', async (req, res) => {
    res.json(INDEX);
});

router.get('/poll', async (req, res) => {

    const sincePosts = new Date(req.cookies.latestPost).getTime();
    const sinceNotifications = parseInt(req.cookies.latestNotification);
    const notifications = getNotifications().filter((n) => n.time > sinceNotifications);
    const inboxIndex = getInboxIndex();
    const unreadDM = Object.keys(inboxIndex).filter((k) => {
            return !inboxIndex[k].lastRead || inboxIndex[k].lastRead < inboxIndex[k].latest;
    })?.length || 0;


    const {
        activitystream
    } = await getActivitySince(sincePosts, true);
    res.json({
        newPosts: activitystream.length,
        newNotifications: notifications.length,
        newDMs: unreadDM,
    });

});


router.get('/followers', async (req, res) => {
    let following = await Promise.all(getFollowing().map(async (f) => {
        const acct = await fetchUser(f.actorId);
        if (acct ?.actor?.id) {
            acct.actor.isFollowing = true; // duh
            return acct.actor;
        }
        return undefined;
    }));

    following = following.filter((f) => f !== undefined);

    let followers = await Promise.all(getFollowers().map(async (f) => {
        const acct = await fetchUser(f);
        if (acct?.actor?.id) {
            acct.actor.isFollowing = following.some((p) => p.id === f);
            return acct.actor;
        }
        return undefined;
    }));

    followers = followers.filter((f) => f !== undefined);

    if (req.query.json) {
        res.json(notes);
    } else {
        res.render('followers', {
            layout: 'private',
            url: '/followers',
            me: ActivityPub.actor,
            followers: followers,
            following: following,
            followersCount: followers.length,
            followingCount: following.length
        });
    }

});

router.get('/following', async (req, res) => {
    let following = await Promise.all(getFollowing().map(async (f) => {
        const acct = await fetchUser(f.actorId);
        if (acct?.actor?.id) {
            acct.actor.isFollowing = true; // duh
            return acct.actor;
        }
        return undefined;
    }));
    following = following.filter((f) => f !== undefined);

    let followers = await Promise.all(getFollowers().map(async (f) => {
        const acct = await fetchUser(f);
        if (acct?.actor?.id) {
            acct.actor.isFollowing = following.some((p) => p.id === f);
            return acct.actor;
        }
        return undefined;
    }));

    followers = followers.filter((f) => f !== undefined);

    if (req.query.json) {
        res.json(notes);
    } else {
        res.render('following', {
            layout: 'private',
            url: '/followers',
            me: ActivityPub.actor,
            followers: followers,
            following: following,
            followersCount: followers.length,
            followingCount: following.length
        });
    }
});


const getFeedList = async (offset = 0, num = 20) => {

    const following = await getFollowing();

    const feeds = await Promise.all(following.map(async (follower) => {
        // posts in index by this author
        // this is probably expensive.
        // what we really need to do is look from this person by date
        // and if we sort right it should be reasonable?
        // and we just return unread counts for everything?
        const posts = INDEX.filter((p) => p.actor == follower.actorId);
        
        // find most recent post
        const mostRecent = posts.sort((a,b) => {
            if (a.published > b.published) {
                return -1;
            } else if (a.published < b.published) {
                return 1;
            } else {
                return 0;
            }
        })[0]?.published || null;

        const account = await fetchUser(follower.actorId);

        return {
            actorId: follower.actorId,
            actor: account.actor,
            postCount: posts.length,
            mostRecent: mostRecent,
        }
    }));

    feeds.sort((a,b) => {
        if (a.mostRecent > b.mostRecent) {
            return -1;
        } else if (a.mostRecent < b.mostRecent) {
            return 1;
        } else {
            return 0;
        }
    });

    return feeds.slice(offset, offset + num);
}


router.get('/', async (req, res) => {

    const followers = await getFollowers();
    const following = await getFollowing();
    const likes = await getLikes();
    const boosts = await getBoosts();
    const offset = parseInt(req.query.offset) || 0;
    const pageSize = 20;

    const {
        activitystream,
        next
    } = await getActivityStream(pageSize, offset);

    const notes = await Promise.all(activitystream.map(async (n) => {
        // handle boosted posts
        if (n.note.type === 'Announce') {
            n.boost = n.note;
            n.booster = n.actor;
            try {
                n.note = await getActivity(n.boost.object);
                const acct = await fetchUser(n.note.attributedTo);
                n.actor = acct.actor;
            } catch (err) {
                console.error('Could not fetch boosted post...', n.boost.object);
                return;
            }
        }

        if (n.actor) {
            n.actor.isFollowing = isFollowing(n.actor.id);

            // determine if this post has already been liked
            n.note.isLiked = (likes.some((l) => l.activityId === n.note.id)) ? true : false;
            n.note.isBoosted = (boosts.some((l) => l.activityId === n.note.id)) ? true : false;

        } else {
            console.error('Post without an actor found', n.note.id);
        }

        return n;
    }));

    const feeds = await getFeedList();

    if (req.query.json) {
        res.json(notes);
    } else {
        // set auth cookie
        res.cookie('token', ActivityPub.account.apikey, {maxAge: (7*24*60*60*1000)});

        res.render('dashboard', {
            layout: 'private',
            url: '/',
            me: ActivityPub.actor,
            offset: offset, 
            next: notes.length == pageSize ? next : null,
            activitystream: notes,
            feeds: feeds,
            followers: followers,
            following: following,
            followersCount: followers.length,
            followingCount: following.length
        });
    }
});

router.get('/notifications', async (req, res) => {
    const likes = await getLikes();
    const offset = parseInt(req.query.offset) || 0;
    const pageSize = 20;
    const notes = getNotifications().slice().reverse().slice(offset, offset+pageSize);
    const notifications = await Promise.all(notes.map(async (notification) => {
        const {
            actor
        } = await fetchUser(notification.notification.actor);
        let note, original;
        // TODO: check if user is in following list
        actor.isFollowing = isFollowing(actor.id);

        if (notification.notification.type === 'Like' || notification.notification.type === 'Announce') {
            note = await getNote(notification.notification.object);
        }
        if (notification.notification.type === 'Reply') {
            try {
                note = await getActivity(notification.notification.object);
                original = await getNote(note.inReplyTo);
                note.isLiked = (likes.some((l) => l.activityId === note.id)) ? true : false;
            } catch(err) {
                console.error('Could not fetch parent post', err);
                return null;
            }
        }
        if (notification.notification.type === 'Mention') {
            try {
                note = await getActivity(notification.notification.object);
                note.isLiked = (likes.some((l) => l.activityId === note.id)) ? true : false;
            } catch(err) {
                console.log('Could not fetch mention post', err);
                return null;
            }
        }

        return {
            actor,
            note,
            original,
            ...notification,
        }
    }));

    const following = getFollowing();
    const followers = getFollowers();

    const feeds = await getFeedList();

    res.render('notifications', {
        layout: 'private',
        me: ActivityPub.actor,
        url: '/notifications',
        offset: offset,
        feeds,
        next: notifications.length == pageSize ? offset + notifications.length : null,
        notifications: notifications.filter((n)=>n!==null),
        followersCount: followers.length,
        followingCount: following.length
    });
});


router.get('/morefeeds', async(req, res) => {

    const feeds = await getFeedList(20, 100);

    res.render('partials/feeds',{
        layout: null,
        feeds: feeds,
        expandfeeds: true,
    });

});

router.get('/feeds/:handle?', async (req, res) => {

    const following = getFollowing();
    const likes = await getLikes();
    const boosts = await getBoosts();
    const offset = parseInt(req.query.offset) || 0;
    const pageSize = 20;
    let feed;

    const getFullPostDetails = async (activityOrId) => {
        let note, actor, boost, booster;
        try {
            if (typeof activityOrId === 'string') {
                note = await getActivity(activityOrId);
            } else {
                note = activityOrId;
            }
        } catch(err) {
            console.error(err);
            console.error('Could not load post in feed');
            return;
        }
    
        const account = await fetchUser(note.attributedTo || note.actor);
        actor = account.actor;

        if (note.type === 'Announce') {
            boost = note;
            booster = actor;
            try {
                note = await getActivity(boost.object);
                const op = await fetchUser(note.attributedTo);
                actor = op.actor;
            } catch (err) {
                console.error(err);
                console.error('Could not fetch boosted post...', boost.object);
                // return;
            }
        }

        note.isLiked = (likes.some((l) => l.activityId === note.id)) ? true : false;
        note.isBoosted = (boosts.some((l) => l.activityId === note.id)) ? true : false;
    
        return {
            note, actor, boost, booster
        }
    
    }

    let feedcount = 20;
    if (req.query.expandfeeds) {
        feedcount = 120;
    }
    const feeds = await getFeedList(0,  feedcount);

    let activitystream;

    if (req.params.handle) {
        const account = await fetchUser(req.params.handle);
        feed = account.actor;
        feed.isFollowing = isFollowing(feed.id);
        feed.isFollower = isFollower(feed.id);

        if (feed.id === req.app.get('account').actor.id || isFollowing(feed.id)) {
            logger('Loading posts from index for', feed.id);
            activitystream = await Promise.all(INDEX.filter((p) => p.actor == account.actor.id).sort((a,b) => {
                if (a.published > b.published) {
                    return -1;
                } else if (a.published < b.published) {
                    return 1;
                } else {
                    return 0;
                }
            }).slice(offset, offset+pageSize).map(async (p) => {
                try {
                    return getFullPostDetails(p.id);
                } catch (err) {
                    console.error('error while loading post from index',err);
                }
            }));
        } else {
            logger('Loading remote posts for', feed.id);
            const {
                items
            } = await ActivityPub.fetchOutbox(feed);
    
            activitystream = !items ? [] : await Promise.all(items.filter((post) => {
                // filter to only include posts and boosts 
                return post.type === 'Create' || post.type === 'Announce';
            }).map(async (post) => {
                try {
                    return getFullPostDetails(post.object);
                } catch (err) {
                    console.error('error while loading post from remote outbox',err);
                }          
            }));
        }

    }

    // res.json(activitystream);
    // return;
    res.render('feeds', {
        layout: 'private',
        me: ActivityPub.actor,
        url: '/feeds',
        feeds,
        feed,
        expandfeeds: req.query.expandfeeds,
        activitystream,
        offset,
        next: activitystream && activitystream.length == pageSize ? offset + activitystream.length : null,
    });

});

router.get('/dms/:handle?', async (req, res) => {
    const inboxIndex = getInboxIndex();
    let error, inbox, recipient, lastIncoming;


    if (req.params.handle) {
        // first validate that this is a real user
        try {
            const account = await fetchUser(req.params.handle);
            recipient = account.actor;
            inbox = getInbox(recipient.id);

            // reverse sort!
            inbox && inbox.sort((a, b) => {
                if (a.published > b.published) {
                    return -1;
                } else if (a.published < b.published) {
                    return 1;
                } else {
                    return 0;
                }
            });

            // find last message in thread
            lastIncoming = inbox.length ? inbox[0] : null;

            // mark all of these messages as seen
            if (inboxIndex[recipient.id]) {
                inboxIndex[recipient.id].lastRead = new Date().getTime();
                writeInboxIndex(inboxIndex);
            }

        } catch (err) {
            error = {
                message: `Could not load user: ${ err.message }`,
            }
        }
    }

    const inboxes = Object.keys(inboxIndex).map((k) => {
        return {
            id: k,
            unread: !inboxIndex[k].lastRead || inboxIndex[k].lastRead < inboxIndex[k].latest,
            ...inboxIndex[k]
        }
    }).sort((a, b) => {
        if (a.latest > b.latest) {
            return -1;
        } else if (a.latest < b.latest) {
            return 1;
        } else {
            return 0;
        }
    });


    res.render('dms', {
        layout: 'private',
        me: ActivityPub.actor,
        url: '/dms',
        lastIncoming: lastIncoming ? lastIncoming.id : null,
        inboxes,
        inbox,
        recipient,
        error
    });
});

router.get('/post', async(req, res) => {

    const to = req.query.to;
    const inReplyTo = req.query.inReplyTo;
    let op;
    let actor;
    let prev;
    if (inReplyTo) {
        op = await getActivity(inReplyTo);
        const account = await fetchUser(op.attributedTo);
        actor = account.actor;
    }

    if (req.query.edit) {
        console.log("COMPOSING EDIT", req.query.edit);
        prev = await getNote(req.query.edit);
        //console.log("ORIGINAL", original);
    }

    res.status(200).render('partials/composer', {
        url: '/post',
        to,
        inReplyTo,
        actor,
        originalPost: op,   // original post being replied to
        prev: prev, // previous version we posted, now editing
        me: req.app.get('account').actor,
        layout: 'private'
    });


});

router.post('/post', async (req, res) => {
    // TODO: this is probably supposed to be a post to /api/outbox
    const post = await createNote(req.body.post, req.body.cw, req.body.inReplyTo, req.body.to, req.body.editOf);
    if (post.directMessage === true) {
        // return html partial of the new post for insertion in the feed
        res.status(200).render('partials/dm', {
            message: post,
            actor: req.app.get('account').actor,
            me: req.app.get('account').actor,
            layout: null,
        });
    } else {
        // return html partial of the new post for insertion in the feed
        res.status(200).render('partials/note', {
            note: post,
            actor: req.app.get('account').actor,
            layout: 'activity'
        });
    }
});

router.get('/find', async (req, res) => {
    let results = [];

    // can we find an exact match
    try {
    const {
        actor
    } = await fetchUser(req.query.handle);
        if (actor && actor.id) {
            actor.isFollowing = isFollowing(actor.id);
            results.push(actor);
        }
    } catch(err) {
        // not found
    }

    const search = await searchKnownUsers(req.query.handle);
    if (search.length) {
        results = results.concat(search);
    }

    res.status(200).render('findresults', {
        layout: 'private',
        url: '/find',
        query: req.query.handle,
        me: ActivityPub.actor,
        results,
    });


});


router.get('/lookup', async (req, res) => {
    const {
        actor
    } = await fetchUser(req.query.handle);
    if (actor) {
        actor.isFollowing = isFollowing(actor.id);
        res.status(200).render('partials/personCard', {
            actor,
            layout: null
        });
    } else {
        res.status(200).send('No user found');
    }
});

router.post('/follow', async (req, res) => {

    const handle = req.body.handle;
    if (handle) {
        if (handle === req.app.get('account').actor.id) {
            return res.status(200).json({
                isFollowed: false
            });
        }
        const {
            actor
        } = await fetchUser(handle);
        if (actor) {
            const status = isFollowing(actor.id);
            if (!status) {
                const message = await ActivityPub.sendFollow(actor);

                return res.status(200).json({
                    isFollowed: true
                });

            } else {
                // send unfollow
                await ActivityPub.sendUndoFollow(actor, status.id);

                // todo: this should just be a function like removeFollowing

                let following = getFollowing();

                // filter out the one we are removing
                following = following.filter((l) => l.actorId !== actor.id);

                writeFollowing(following);

                return res.status(200).json({
                    isFollowed: false
                });
            }
        }
    }
    res.status(404).send('not found');
});

router.post('/like', async (req, res) => {
    const activityId = req.body.post;
    let likes = getLikes();
    if (!likes.some((l) => l.activityId === activityId)) {

        const post = await getActivity(activityId);
        const recipient = await fetchUser(post.attributedTo);
        const message = await ActivityPub.sendLike(post, recipient.actor);
        const guid = message.id;

        likes.push({
            id: guid,
            activityId,
        });
        res.status(200).json({
            isLiked: true
        });
    } else {
        // extract so we can send an undo record
        const recordToUndo = likes.find((l) => l.activityId === activityId);

        const post = await getActivity(activityId);
        const recipient = await fetchUser(post.attributedTo);

        await ActivityPub.sendUndoLike(post, recipient.actor, recordToUndo.id);

        // filter out the one we are removing
        likes = likes.filter((l) => l.activityId !== activityId);

        // send status back
        res.status(200).json({
            isLiked: false
        });
    }
    writeLikes(likes);
});

router.post('/boost', async (req, res) => {
    const activityId = req.body.post;
    let boosts = getBoosts();
    if (!boosts.some((l) => l.activityId === activityId)) {

        const post = await getActivity(activityId);
        const account = await fetchUser(post.attributedTo);
        const followers = await getFollowers();
        const fullFollowers = await Promise.all(followers.map(async (follower) => {
            const {
                actor
            } = await fetchUser(follower);
            return actor;
        }));
        const message = await ActivityPub.sendBoost(account.actor, post, fullFollowers);

        boosts.push({
            id: message.id,
            activityId,
        });
        res.status(200).json({
            isBoosted: true
        });
    } else {
        // extract so we can send an undo record
        const recordToUndo = boosts.find((l) => l.activityId === activityId);
        const post = await getActivity(activityId);
        const account = await fetchUser(post.attributedTo);
        const followers = await getFollowers();
        const fullFollowers = await Promise.all(followers.map(async (follower) => {
            const {
                actor
            } = await fetchUser(follower);
            return actor;
        }));
        await ActivityPub.sendUndoBoost(account.actor, post, fullFollowers, recordToUndo.id);

        // filter out the one we are removing
        boosts = boosts.filter((l) => l.activityId !== activityId);

        // send status back
        res.status(200).json({
            isBoosted: false
        });
    }
    writeBoosts(boosts);
});
