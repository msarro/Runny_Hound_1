# Runny Hound

An endless-runner browser game in the spirit of the classic "dino run." A Greyhound, the Moravian University mascot, races through Bethlehem, PA, leaping over obstacles from the university and the Christmas City.

**Every graphic and sound is generated in code.** The art is drawn with Canvas 2D paths and the audio is synthesized with the Web Audio API. There are no image or audio files.

## Play

Open `index.html` in any modern browser. No build step and no server are needed.

To serve it instead (e.g. for phones on the same network):

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

| Control | Action |
| --- | --- |
| `Space` / `↑` / tap | Jump (hold for a higher leap) |
| `↓` | Duck under flying stars / drop faster mid-air |
| `M` | Mute all sound |
| `N` | Toggle music |
| `P` / `Esc` | Pause |

On touch devices, on-screen **Jump** and **Duck** buttons appear under the game.

## What's in it

- **The hound** is a grey Greyhound in a Moravian-blue racing coat with a gold-trimmed "M" and a Moravian Star collar tag. It has a procedurally animated gallop (inverse-kinematics legs), jump, duck and crash poses.
- **Obstacles.** Each one shows a fun fact when you trip over it:
  - Lovefeast candle: beeswax with a red paper frill
  - Moravian Star lantern
  - Bethlehem Steel "Grey beam"
  - Marshmallow chick (Just Born is a Bethlehem company)
  - Stack of library books (Moravian, founded 1742)
  - Flying Moravian Star, which you jump over or duck under
- **Scenery** has four parallax layers:
  - South Mountain with the Bethlehem Star
  - The Bethlehem Steel blast furnaces, lit in colors at night
  - Central Moravian Church's belfry, Comenius Hall's tower and colonial row houses with Moravian Stars in the windows
  - Gas lamps with blue banners, a campus sign and a brick sidewalk
- **Day/night cycle.** The game starts at night with falling snow and twinkling holiday lights. Day follows, then night again.
- **Audio.** Jump, landing, crash and milestone chime effects play every 100 points. The music is an original looping chorale voiced like a Moravian trombone choir.
- **Colors.** Navy and royal blue with grey and white, following the Greyhounds' blue & grey. Gold comes from a lit Moravian Star. The hex values are approximations, not official brand values.

## Project layout

```
index.html      page shell, how-to-play and obstacle legend
css/style.css   page styling
js/art.js       all procedural drawing: hound, stars, obstacles, scenery
js/audio.js     synthesized sound effects and music
js/game.js      game loop, physics, input, HUD
```

## Developer URL flags

Append these to the URL, e.g. `index.html?autostart&god&score=600`:

- `autostart`: skip the title screen
- `god`: disable collisions
- `hitboxes`: draw collision boxes
- `score=N`: start at score N (speed and day/night match that score)
- `sim=N`: fast-forward N seconds of game time before the first frame (useful for screenshots)

## License

Copyright © 2026 Matty Sarro.

This work is licensed under [Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0)](https://creativecommons.org/licenses/by-nc-nd/4.0/). You may share it with attribution, for non-commercial purposes only, and you may not distribute modified versions. See [LICENSE](LICENSE) for the full legal text.

---

*A fan-made demo inspired by the Moravian University Greyhounds; not an official university product.*
