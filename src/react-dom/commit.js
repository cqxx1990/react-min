import { PLACEMENT_FLAG, UPDATE_FLAG } from "./defines";
import { FiberNode } from "./fiber";

export function commit(root) {
  const finishWork = root.current.alternate; // root.current为已渲染完的对象，alternate是正在协调的fiber树
  commitFiber(root, finishWork);
  root.current = finishWork; // 切换fiber树
}
/**
 * 递归生效每一个fiber。官方还在complete阶段标记了fiber.subtreeFlags，如果此标记存在，则表示不需要递归下级了，节省了遍历开销
 * @param {Root} root 
 * @param {FiberNode} work 
 */
function commitFiber(root, work) {
  const elementType = typeof work.type;
  work.lanes = work.childLanes = 0; // 重置标记
  if (work.alternate) {
    work.alternate.lanes = work.alternate.childLanes = 0;
  }
  if (elementType === "string") {
    recursiveMutation(root, work); // 递归渲染子节点
    if (work.flags & PLACEMENT_FLAG) {
      // 如果标记是新增节点
      let before = work.sibling; // 找到下一个兄弟节点
      while (before) {
        if (before.flags & PLACEMENT_FLAG) {
          before = before.sibling;
        }
      }
      let parent = work.return;
      do {
        if (parent.stateNode) {
          //查找有真实节点的上级，函数节点的stateNode为空
          parent.stateNode.insertBefore(
            work.stateNode,
            before ? before.stateNode : null
          );
          break;
        }
        parent = parent.return;
      } while (parent);
      work.flags &= ~PLACEMENT_FLAG; // 重置flags标记
      if (work.alternate) {
        work.alternate.flags &= ~PLACEMENT_FLAG;
      }
    }
    if (work.flags & UPDATE_FLAG) {
      if (work.type === "TEXT") {
        // 如果是文本，则直接更新
        work.stateNode.textContent = work.pendingProps;
      } else {
        const newProps = work.pendingProps || {}; // 更新props，官方算法更好一点点，在completeWork阶段计算差异的属性，然后缓存到updateQueue属性上
        Object.entries(newProps).forEach(([k, v]) => {
          if (typeof v === "string" || typeof v === "number")
            work.stateNode.setAttribute(k, v);
        });
        const oldProps = work.memorizedProps || {};
        Object.keys(oldProps).forEach((k) => {
          if (typeof v === "string" || typeof v === "number")
            if (!newProps[k]) {
              work.stateNode.removeAttribute(k);
            }
        });
        work.memorizedProps = work.pendingProps;
      }
      work.stateNode.__react_props = work.memorizedProps;
      work.flags &= ~UPDATE_FLAG;
      if (work.alternate) {
        work.alternate.flags &= ~UPDATE_FLAG;
      }
    }
  } else if (elementType === "function") {
    recursiveMutation(root, work);
  }
}

function recursiveMutation(root, work) {
  if (work.deletions) {
    work.deletions.forEach(recursiveDelete); // 删除本节上标记的移除节点
  }
  // react源码中对这里还进行了判断是否子节点有变更
  let child = work.child;
  while (child) {
    commitFiber(root, child);
    child = child.sibling;
  }
}

function recursiveDelete(fiber) {
  // 递归删除子节点
  if (typeof fiber.type === "string") {
    if (fiber.stateNode) {
      fiber.stateNode.remove();
    }
  } else {
    let child = fiber.child;
    while (child) {
      recursiveDelete(child);
      child = child.sibling;
    }
  }
}
