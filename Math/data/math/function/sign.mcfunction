data remove storage math: error
execute unless predicate math:internal/finite/a run data remove storage math: ans
execute unless predicate math:internal/finite/a run data modify storage math: error set value "invalid_number"
execute unless predicate math:internal/finite/a run return fail
data modify storage math:internal x set from storage math: a
data modify storage math: ans set value 0.0
execute if predicate math:internal/range/negative run data modify storage math: ans set value -1.0
execute if predicate math:internal/range/positive run data modify storage math: ans set value 1.0
return 1
