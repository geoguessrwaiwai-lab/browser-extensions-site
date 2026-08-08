(() => {
  const videos = Array.from(document.querySelectorAll("[data-comparison-video]"));

  if (videos.length !== 2) return;

  const endedVideos = new Set();
  let isRestarting = false;

  const playTogether = async () => {
    videos.forEach((video) => {
      // iOS Safari checks the DOM property as well as the HTML attribute when
      // deciding whether programmatic playback is allowed.
      video.muted = true;
      video.currentTime = 0;
    });

    await Promise.allSettled(videos.map((video) => video.play()));
  };

  videos.forEach((video) => {
    video.addEventListener("ended", async () => {
      endedVideos.add(video);

      if (endedVideos.size !== videos.length || isRestarting) return;

      isRestarting = true;
      endedVideos.clear();
      await playTogether();
      isRestarting = false;
    });
  });

  // Do not wait for both videos' `canplay` events. Mobile Safari may defer
  // loading an off-screen video until playback is requested, causing a
  // canplay-before-play deadlock.
  void playTogether();
})();
