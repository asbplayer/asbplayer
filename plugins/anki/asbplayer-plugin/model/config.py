from typing import Any

from aqt import mw


class AddonConfig:
    DEFAULT_ENABLED = True
    DEFAULT_PORT = 8766
    DEFAULT_POST_MINE_ACTION = 2

    def __init__(self, module_name: str) -> None:
        self._module_name = module_name
        self._config: dict[str, Any] = {}
        self.set_config()

    def set_config(self) -> None:
        self._config = mw.addonManager.getConfig(self._module_name) or {}

        changed = False
        if not isinstance(self._config.get("enabled"), bool):
            self._config["enabled"] = self.DEFAULT_ENABLED
            changed = True

        if not isinstance(self._config.get("port"), int):
            self._config["port"] = self.DEFAULT_PORT
            changed = True

        if self._config.get("postMineAction") not in [0, 1, 2]:
            self._config["postMineAction"] = self.DEFAULT_POST_MINE_ACTION
            changed = True

        if changed:
            self._save_config()

    def _save_config(self) -> None:
        mw.addonManager.writeConfig(self._module_name, self._config)

    def get_enabled(self) -> bool:
        return bool(self._config.get("enabled", self.DEFAULT_ENABLED))

    def get_port(self) -> int:
        return int(self._config.get("port", self.DEFAULT_PORT))

    def get_post_mine_action(self) -> int:
        return int(self._config.get("postMineAction", self.DEFAULT_POST_MINE_ACTION))
