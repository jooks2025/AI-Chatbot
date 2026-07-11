// CrazyGames SDK 연동 래퍼
// CrazyGames 플랫폼 밖(로컬/깃허브 등)에서 열어도 게임이 정상 동작하도록
// SDK가 없으면 모든 호출을 안전하게 폴백 처리한다.
const AdSDK = (() => {
  let ready = false;
  let sdk = null;

  function init() {
    return new Promise((resolve) => {
      if (typeof window.CrazyGames === 'undefined') {
        console.warn('[AdSDK] CrazyGames SDK를 찾을 수 없습니다. 로컬 테스트 모드로 동작합니다.');
        resolve(false);
        return;
      }
      sdk = window.CrazyGames.SDK;
      sdk
        .init()
        .then(() => {
          ready = true;
          resolve(true);
        })
        .catch((err) => {
          console.warn('[AdSDK] 초기화 실패:', err);
          resolve(false);
        });
    });
  }

  function loadingStart() {
    if (ready) sdk.game.loadingStart();
  }

  function loadingStop() {
    if (ready) sdk.game.loadingStop();
  }

  function gameplayStart() {
    if (ready) sdk.game.gameplayStart();
  }

  function gameplayStop() {
    if (ready) sdk.game.gameplayStop();
  }

  // 웨이브 사이(자연스러운 전환 지점)에 노출하는 인터스티셜 광고
  function showMidgameAd(onDone) {
    if (!ready) {
      onDone();
      return;
    }
    gameplayStop();
    sdk.ad.requestAd('midgame', {
      adFinished: () => {
        onDone();
      },
      adError: () => {
        onDone();
      },
    });
  }

  // 플레이어가 직접 요청하는 보상형 광고 (부활 / 2배 보상)
  function showRewardedAd(onReward, onError) {
    if (!ready) {
      // 로컬 테스트 모드: SDK 없이도 보상 흐름을 확인할 수 있도록 즉시 보상 지급
      onReward();
      return;
    }
    gameplayStop();
    sdk.ad.requestAd('rewarded', {
      adFinished: () => {
        onReward();
      },
      adError: () => {
        if (onError) onError();
      },
    });
  }

  return {
    init,
    loadingStart,
    loadingStop,
    gameplayStart,
    gameplayStop,
    showMidgameAd,
    showRewardedAd,
  };
})();
