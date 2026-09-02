data modify storage math: internal.w_comparison.predicate.bezier_time_at_or_below_start set compute default float math:.validation/predicate/bezier/time_at_or_below_start/value
execute if predicate math:.validation/bezier/time_at_or_below_start run return run data modify storage math: ans set from storage math: a
data modify storage math: internal.w_comparison.predicate.bezier_time_at_or_after_end set compute default float math:.validation/predicate/bezier/time_at_or_after_end/value
execute if predicate math:.validation/bezier/time_at_or_after_end run return run data modify storage math: ans set from storage math: b
data modify storage math: internal.x set from storage math: max
data modify storage math: internal.y set from storage math: t
function math:.common/reciprocal/0.start
data modify storage math: internal.w_bezier_u set from storage math: internal.x
data modify storage math: internal.w_bezier_low set value 0.0f
data modify storage math: internal.w_bezier_high set value 1.0f
function math:bezier/2.solve
data modify storage math: internal.w_bezier_midpoint set compute default float math:bezier/midpoint
data modify storage math: internal.w_bezier_y set compute default float math:bezier/y
data modify storage math: ans set compute default float math:bezier/result
