import type { errors as en } from '../en/errors';

export const errors: Record<keyof typeof en, string> = {
  'errors.storage.notObject': '状态数据不是有效对象。',
  'errors.storage.newerVersion': '此备份由更新版本的 Adilingo 创建（数据结构 v{version}）。',
  'errors.storage.unreadable': '无法读取已保存的进度（{reason}）。已将一份副本保存在“{storageKey}”下。',
  'errors.backup.invalidJson': '该文件不是有效的 JSON。',
  'errors.backup.notBackup': '这看起来不是 Adilingo 备份文件。',
};
