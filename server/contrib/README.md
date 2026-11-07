# Training contributions (opt-in)

Users who agree in the app ("Help improve the detection") send their screenshot and their own corrections:
- The screenshot is sent as a JPEG with the game's top and bottom bars blacked out.
- The corrections are marked tiles, cities and units.

The app sends this anonymously to `POST /api/contrib`. `server.py` stores one JSON file per screenshot in
`/var/lib/polytopia-contrib/`. It keeps no IP address and no request log, and nginx passes no client address.
`POST /api/contrib/delete` removes a user's contributions. The app keeps the ids it sent on the device.

Setup on the VPS: see `install.sh`. To fetch the contributions and turn them into a training dataset, run
`tools/contrib/pull.sh`.
