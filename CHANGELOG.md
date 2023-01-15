# How to update

For now, the best way to upgrade is to pull the latest code from the main branch.
(One day I'll set up proper packaging with versions and stuff. That day is not today!)

* Type `git pull origin main` 
* Make sure to restart the app afterwards

# CHANGE LOG

## 2023-01-15
- Added a prefs page
- Added the ability to change all the emojis in the UI 👹
- Added the ability to change what it says on the "post" button
See a video of these features in action here: https://www.loom.com/share/c8fbe3b099f644d596cd2db26e86bc8a


## 2023-01-14
- All new nav! There is now a list of the 20 most recently updated feeds in the nav. Click "..." to see up to 100.
- Lots of CSS improvements!
- When you search for a user, Shuttlecraft will now also search all known users


## 2023-01-12
- Prevent buttons from being double-clicked resulting in accidentally undoing something or double posting
- Prevent the account.json file from being created with a faulty domain name. Thanks @patrickmcurry!


## 2023-01-09
- Fixed a bug causing new posts not to show up til the server restarts. Oops!

## 2023-01-08
- Added support for incoming DELETE activities. This causes matching posts to be completely removed from the system. As part of this, increased resilience for dealing with missing or unreachable posts. Thanks to @ringtailsoftware.
- Added support for editing local posts. Thanks to @ringtailsoftware.
- Renamed the sample .env to .env.example and introduced a post-install script to copy it into place
- Created this changelog!

## 2023-01-07
- Links in posts now automatically include noopen noreferer nofollow attributes.

## 2023-01-06
- Support for light/dark themes. Thanks @anildash
- Fix pagination bugs, add pagination on notifications


