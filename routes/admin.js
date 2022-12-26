import {
    getActivity,
    getActivitySince,
    getActivityStream
} from '../lib/notes.js';
import express from 'express';
export const router = express.Router();
import debug from 'debug';
import { createHash } from 'crypto';
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
    isFollowing,
    getInboxIndex,
    getInbox,
    writeInboxIndex,
    writeMedia,
    updateAccountActor
} from '../lib/account.js';
import {
    fetchUser
} from '../lib/users.js';
import {
    INDEX
} from '../lib/storage.js';
import {
    ActivityPub
} from '../lib/ActivityPub.js';
import {
    UserEvent
} from '../lib/UserEvent.js';
import { encode as blurhashEncode } from 'blurhash';
import { getSync as imageDataGetSync } from '@andreekeberg/imagedata'
const {
  USERNAME,
  DOMAIN
} = process.env;

const logger = debug('ono:admin');

router.get('/index', async (req, res) => {
    res.json(INDEX);
});

router.get('/poll', async (req, res) => {
    if (!req.query.nowait) {
        req.on('close', function (err){
            UserEvent.abort();
            return;
        });
        try {
            await UserEvent.waitForEvent();
        } catch(e) {
            // we got aborted
        }
    }
    const sincePosts = new Date(req.cookies.latestPost).getTime();
    const sinceNotifications = parseInt(req.cookies.latestNotification);//.filter((n) => {n.});
    // notification mechanism used to indicate there are unread posts, but they shouldn't appear in notifications tab
    const notifications = getNotifications().filter((n) => n.notification.type !== 'NewPost').filter((n) => n.time > sinceNotifications);
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
            me: ActivityPub.actor,
            followers: followers,
            following: following,
            followersCount: followers.length,
            followingCount: following.length
        });
    }
});




router.get('/', async (req, res) => {

    const followers = await getFollowers();
    const following = await getFollowing();
    const likes = await getLikes();
    const boosts = await getBoosts();
    const offset = parseInt(req.query.offset) || 0;
    const {
        activitystream,
        next
    } = await getActivityStream(10, offset);



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

    // de-dupe notes by id, else will get two on edits
    const uniqueIds = new Set();
    const uniqueNotes = notes.filter(element => {
      const isDuplicate = uniqueIds.has(element.note.id);
      uniqueIds.add(element.note.id);
      if (!isDuplicate) {
        return true;
      }
      return false;
    });

    if (req.query.json) {
        res.json(uniqueNotes);
    } else {
        // set auth cookie
        res.cookie('token', ActivityPub.account.apikey, {maxAge: (7*24*60*60*1000)});

        res.render('dashboard', {
            layout: 'private',
            me: ActivityPub.actor,
            next: next,
            activitystream: uniqueNotes,
            followers: followers,
            following: following,
            followersCount: followers.length,
            followingCount: following.length
        });
    }
});

router.get('/notifications', async (req, res) => {
    const likes = await getLikes();
    const notifications = await Promise.all(getNotifications().map(async (notification) => {
        const {
            actor
        } = await fetchUser(notification.notification.actor);
        let note, original;
        // TODO: check if user is in following list
        actor.isFollowing = isFollowing(actor.id);

        if (notification.notification.type === 'Like' || notification.notification.type === 'Announce' || notification.notification.type === 'Vote') {
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

    res.render('notifications', {
        layout: 'private',
        me: ActivityPub.actor,
        notifications: notifications.filter((n)=>n!==null).reverse()
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

    const inboxesWithAccounts = await Promise.all(inboxes.map(async (inbox) => {
        return {
            id: inbox.id,
            unread: inbox.unread,
            lastRead: inbox.lastRead,
            latest: inbox.latest,
            ... await fetchUser(inbox.id)
        };
    }));

    res.render('dms', {
        layout: 'private',
        me: ActivityPub.actor,
        lastIncoming: lastIncoming ? lastIncoming.id : null,
        inboxesWithAccounts,
        inbox,
        recipient,
        error
    });
});

router.get('/post', async(req, res) => {

    const to = req.query.to;
    const inReplyTo = req.query.inReplyTo;
    let names = [];
    let op;
    let actor;
    let prev;
    if (inReplyTo) {
        op = await getActivity(inReplyTo);
        const account = await fetchUser(op.attributedTo);
        actor = account.actor;
    }

    if (req.query.names) {
        names = JSON.parse(req.query.names);
    }

    if (req.query.edit) {
        prev = await getNote(req.query.edit);
    }

    res.status(200).render('partials/composer', {
        to,
        inReplyTo,
        actor,
        originalPost: op,   // original post being replied to
        prev: prev, // previous version we posted, now editing
        me: req.app.get('account').actor,
        names: names,
        layout: 'private'
    });


});

router.post('/post', async (req, res) => {
    // TODO: this is probably supposed to be a post to /api/outbox
    let attachment;

    if (req.body.attachment) {
        // convert attachment.data to raw buffer
        attachment = calculateAttachmentHashAndData(req.body.attachment);
        attachment.description = req.body.description || '';

        if (attachment.type.split('/')[0] == 'image') {
            // calculate dimensions and blurhash
            let imageData = imageDataGetSync(attachment.data);
            attachment.focalPoint = '0.0,0.0';
            attachment.width = imageData.width;
            attachment.height = imageData.height;
            attachment.blurhash = blurhashEncode(imageData.data, imageData.width, imageData.height, 4, 4);
        }

        writeMedia(attachment);
    }

    let post;
    if (req.body.names && req.body.names.length > 0) {
        // send multiple notes, one for each choice made in poll
        for (const name of req.body.names) {
            post = await createNote(req.body.post, req.body.cw, req.body.inReplyTo, name, req.body.to, null, attachment, req.body.editOf);
        }
    } else {
        post = await createNote(req.body.post, req.body.cw, req.body.inReplyTo, null, req.body.to, req.body.polldata, attachment, req.body.editOf);
    }

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

router.get('/profile/:handle', async (req, res) => {
    const {
        actor
    } = await fetchUser(req.params.handle);
    const likes = await getLikes();
    const boosts = await getBoosts();

    if (actor) {
        actor.isFollowing = isFollowing(actor.id);
        const {
            items
        } = await ActivityPub.fetchOutbox(actor);

        const posts = !items ? [] : items.filter((post) => {
            // filter to only include my posts
            // not boosts or other activity
            // TODO: support boosts
            return post.type === 'Create';
        }).map((post) => {
            // TODO: this should fetch in case the outbox only has ids
            // let note = (typeof post.object==="string") ? await getActivity(post.object) : post.object;

            let note = post.object;
            // determine if this post has already been liked
            note.isLiked = (likes.some((l) => l.activityId === note.id)) ? true : false;
            note.isBoosted = (boosts.some((l) => l.activityId === note.id)) ? true : false;

            return {
                actor: actor,
                note: note,
            };
        });
        res.status(200).render('partials/profile', {
            actor,
            activitystream: posts,
            me: ActivityPub.actor,
            layout: 'private'
        });
    } else {
        res.status(200).send('No user found');
    }
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

router.get('/settings', async (req, res) => {
    res.render('settings', {
        layout: 'private',
        actor: ActivityPub.actor,
        me: ActivityPub.actor
    });
});

function calculateAttachmentHashAndData(att) {
    let attachment = {
        type: att.type,
        data: Buffer.from(att.data, 'base64'),
    };
    attachment.hash = createHash('md5').update(att.data).digest("hex");
    return attachment;
}

router.post('/settings', async (req, res) => {
    if (req.body.attachment_avatar || req.body.attachment_header) {
        if (!req.body.account) {    // ensure account gets updated as we're changing the urls
            req.body.account = {};
        }
        if (!req.body.account.actor) {
            req.body.account.actor = {};
        }
    }
    if (req.body.attachment_avatar) {
        let att = calculateAttachmentHashAndData(req.body.attachment_avatar);
        writeMedia(att);
        req.body.account.actor.icon = {
            type: 'Image',
            mediaType: att.type,
            url: `https://${ DOMAIN }/media/${att.hash}.${att.type.split('/')[1]}`
        };
    }
    if (req.body.attachment_header) {
        let att = calculateAttachmentHashAndData(req.body.attachment_header);
        writeMedia(att);
        req.body.account.actor.image = {
            type: 'Image',
            mediaType: att.type,
            url: `https://${ DOMAIN }/media/${att.hash}.${att.type.split('/')[1]}`
        };
    }
    if (req.body.account && req.body.account.actor) {
        await updateAccountActor(req.body.account.actor);
    }
    res.status(200).send();
});

