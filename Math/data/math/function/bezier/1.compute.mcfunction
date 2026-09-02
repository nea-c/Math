execute if predicate math:.validation/bezier/time_at_or_below_start run return run data modify storage math: ans set from storage math: a
execute if predicate math:.validation/bezier/time_at_or_after_end run return run data modify storage math: ans set from storage math: b
data modify storage math: internal.w_bezier_u set compute default float {"type":"div","left":{"type":"storage","storage":"math:","path":"t"},"right":{"type":"storage","storage":"math:","path":"max"}}
data modify storage math: internal.w_bezier_low set value 0.0f
data modify storage math: internal.w_bezier_high set value 1.0f
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
function math:bezier/2.step
data modify storage math: internal.w_bezier_midpoint set compute default float math:bezier/midpoint
data modify storage math: internal.w_bezier_y set compute default float math:bezier/y
data modify storage math: ans set compute default float math:bezier/result
