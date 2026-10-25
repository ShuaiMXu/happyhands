import { StateNode, createShapeId, renderPlaintextFromRichText, startEditingShapeWithRichText, toRichText } from 'tldraw';
import { getLanguage, t } from '../i18n.js';
import { formatRegionComments } from './region-comment-format.js';
export { formatRegionComments } from './region-comment-format.js';

export const REGION_COMMENT_TOOL_ID = 'cowart-region-comment';
const MIN_REGION_SIZE = 16;

export function regionCommentInstructions(editor) {
  const placeholders = new Set(['写下批注…', 'Write a comment…']);
  const comments = editor.getCurrentPageShapes()
    .filter(shape => shape.meta?.cowartRegionComment === true)
    .map(shape => ({
      x: shape.x,
      y: shape.y,
      w: shape.props.w,
      h: shape.props.h,
      text: renderPlaintextFromRichText(editor, shape.props.richText).trim()
    }))
    .filter(comment => comment.text && !placeholders.has(comment.text));
  return formatRegionComments(comments, getLanguage());
}

export class CowartRegionCommentTool extends StateNode {
  static id = REGION_COMMENT_TOOL_ID;
  static initial = 'idle';

  static children() {
    return [CowartRegionCommentIdle, CowartRegionCommentPointing];
  }

  onEnter() {
    if (this.editor.getInstanceState().isToolLocked) this.editor.updateInstanceState({ isToolLocked: false });
  }
}

class CowartRegionCommentIdle extends StateNode {
  static id = 'idle';

  onEnter() {
    this.editor.setCursor({ type: 'cross', rotation: 0 });
  }

  onPointerDown(info) {
    this.parent.transition('pointing', info);
  }

  onCancel() {
    this.editor.setCurrentTool('select');
  }
}

class CowartRegionCommentPointing extends StateNode {
  static id = 'pointing';
  shapeId = null;
  markId = '';
  origin = null;

  onEnter() {
    const point = this.editor.inputs.getOriginPagePoint();
    this.origin = { x: point.x, y: point.y };
    this.shapeId = createShapeId();
    this.markId = this.editor.markHistoryStoppingPoint(`creating_region_comment:${this.shapeId}`);
    this.editor.createShape({
      id: this.shapeId,
      type: 'geo',
      x: point.x,
      y: point.y,
      opacity: .9,
      meta: { cowartRegionComment: true },
      props: {
        w: 1,
        h: 1,
        geo: 'rectangle',
        dash: 'draw',
        fill: 'semi',
        size: 'm',
        color: 'red',
        labelColor: 'black',
        font: 'sans',
        align: 'start',
        verticalAlign: 'start',
        richText: toRichText(t('写下批注…')),
        scale: this.editor.getResizeScaleFactor()
      }
    });
  }

  onPointerMove() {
    this.updateRegion();
  }

  onPointerUp() {
    this.complete();
  }

  onCancel() {
    this.cancel();
  }

  onInterrupt() {
    this.cancel();
  }

  updateRegion() {
    if (!this.shapeId || !this.origin) return;
    const point = this.editor.inputs.getCurrentPagePoint();
    this.editor.updateShape({
      id: this.shapeId,
      type: 'geo',
      x: Math.min(this.origin.x, point.x),
      y: Math.min(this.origin.y, point.y),
      props: {
        w: Math.max(1, Math.abs(point.x - this.origin.x)),
        h: Math.max(1, Math.abs(point.y - this.origin.y))
      }
    });
  }

  complete() {
    if (!this.shapeId || !this.origin) return this.cancel();
    this.updateRegion();
    const shape = this.editor.getShape(this.shapeId);
    const minimum = MIN_REGION_SIZE / this.editor.getZoomLevel();
    if (!shape || shape.props.w < minimum || shape.props.h < minimum) return this.cancel();
    this.editor.select(this.shapeId);
    startEditingShapeWithRichText(this.editor, this.shapeId, { selectAll: true });
    this.editor.getCurrentTool().setCurrentToolIdMask(REGION_COMMENT_TOOL_ID);
  }

  cancel() {
    if (this.shapeId) this.editor.bailToMark(this.markId);
    this.parent.transition('idle');
  }
}
