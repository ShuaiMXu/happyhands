export function formatRegionComments(comments, language = 'zh') {
  return comments.map((comment, index) => {
    const bounds = `x ${Math.round(comment.x)}, y ${Math.round(comment.y)}, w ${Math.round(comment.w)}, h ${Math.round(comment.h)}`;
    return language === 'en'
      ? `Region ${index + 1} (${bounds}): ${comment.text}`
      : `局部 ${index + 1}（${bounds}）：${comment.text}`;
  }).join('\n');
}
