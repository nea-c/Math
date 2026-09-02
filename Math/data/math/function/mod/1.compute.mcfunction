execute if data storage math: {b:0.0f} run return run data modify storage math: ans set compute default float {"type":"mod","left":{"type":"storage","storage":"math:","path":"a"},"right":{"type":"storage","storage":"math:","path":"b"}}
data modify storage math: internal.x set from storage math: b
data modify storage math: internal.x set from storage math: a
data modify storage math: internal.x set compute default float math:.common/abs
data modify storage math: internal.z set from storage math: internal.x
data modify storage math: internal.x set from storage math: b
data modify storage math: internal.x set compute default float math:.common/abs
data modify storage math: internal.y set from storage math: internal.x
data modify storage math: internal.x set from storage math: internal.z
function math:.common/reduce_remainder/0.start
data modify storage math: internal.z set compute default float math:.common/input/x
data modify storage math: internal.w_comparison.predicate.rounding_remainder_zero set compute default float math:.validation/predicate/rounding/remainder/zero/value
execute if predicate math:.validation/rounding/remainder/zero run return run data modify storage math: ans set value 0.0f
data modify storage math: internal.w_comparison.predicate.rounding_public_a_negative set compute default float math:.validation/predicate/rounding/public/a_negative/value
data modify storage math: internal.w_comparison.predicate.rounding_public_b_negative set compute default float math:.validation/predicate/rounding/public/b_negative/value
execute if predicate math:.validation/rounding/public/b_negative run return run function math:mod/2.negative_b
execute unless predicate math:.validation/rounding/public/a_negative run return run data modify storage math: ans set compute default float {"type":"storage","storage":"math:","path":"internal.z"}
data modify storage math: internal.x set from storage math: internal.y
data modify storage math: internal.y set from storage math: internal.z
data modify storage math: ans set compute default float math:.common/sub
